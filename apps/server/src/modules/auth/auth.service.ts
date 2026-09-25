import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { AuthProvider } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { PrismaClientOrTransaction } from "../../lib/prisma.types";
import { mailer } from "../../lib/mail";
import { getEnv, durationMs } from "../../config/env";
import { ApiError } from "../../shared/errors/ApiError";
import { HTTP_STATUS } from "../../shared/constants/http-status";
import { logger } from "../../shared/logger/logger";
import authRepository from "./auth.repository";
import { LoginRequest, RegisterRequest } from "./auth.validation";
import { AUTH_CONSTANTS, AUTH_MESSAGES } from "./auth.constants";
import { SafeUser, SessionResult } from "./auth.types";
import {
  accessToken,
  hashesEqual,
  parseRefreshToken,
  randomToken,
  refreshHash,
  resetHash,
  verifyAccessToken,
} from "./auth.tokens";

// Cost matches real passwords so unknown accounts still do password work.
const dummyHash = bcrypt.hash(randomToken(), AUTH_CONSTANTS.SALT_ROUNDS);
const safeUser = (user: {
  id: string;
  name: string;
  avatar: string | null;
}): SafeUser => ({ id: user.id, name: user.name, avatar: user.avatar });
const unauthorized = () =>
  new ApiError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.SESSION_EXPIRED);

class AuthService {
  private async createSession(
    db: PrismaClientOrTransaction,
    user: { id: string; name: string; avatar: string | null },
  ): Promise<SessionResult> {
    const env = getEnv();
    const id = randomUUID();
    const refreshToken = `${id}.${randomToken()}`;
    const refreshMaxAge = durationMs(env.REFRESH_TOKEN_EXPIRY);
    const token = accessToken(user.id, id);
    await authRepository.createSession(db, {
      id,
      userId: user.id,
      refreshTokenHash: refreshHash(refreshToken),
      expiresAt: new Date(Date.now() + refreshMaxAge),
    });
    return {
      user: safeUser(user),
      accessToken: token,
      refreshToken,
      accessMaxAge: durationMs(env.ACCESS_TOKEN_EXPIRY),
      refreshMaxAge,
    };
  }

  async login(data: LoginRequest): Promise<SessionResult> {
    const provider = data.email ? AuthProvider.EMAIL : AuthProvider.MOBILE;
    const identifier = data.email ?? data.mobileNumber!;
    const authentication = await authRepository.findAuthentication(
      prisma,
      provider,
      identifier,
    );
    const comparedHash = authentication?.passwordHash ?? (await dummyHash);
    const passwordMatches = await bcrypt.compare(data.password, comparedHash);
    if (!authentication || !passwordMatches || !authentication.user.isActive) {
      throw new ApiError(
        HTTP_STATUS.UNAUTHORIZED,
        AUTH_MESSAGES.INVALID_CREDENTIALS,
      );
    }
    return authRepository.transaction(prisma, async (tx) => {
      await authRepository.lockUser(tx, authentication.userId);
      const current = await authRepository.findAuthentication(
        tx,
        provider,
        identifier,
      );
      if (
        !current ||
        current.passwordHash !== comparedHash ||
        !current.user.isActive
      ) {
        throw new ApiError(
          HTTP_STATUS.UNAUTHORIZED,
          AUTH_MESSAGES.INVALID_CREDENTIALS,
        );
      }
      return this.createSession(tx, current.user);
    });
  }

  async register(data: RegisterRequest): Promise<SessionResult> {
    const provider = data.email ? AuthProvider.EMAIL : AuthProvider.MOBILE;
    const identifier = data.email ?? data.mobileNumber!;
    const existing = await authRepository.findAuthentication(
      prisma,
      provider,
      identifier,
    );
    if (existing)
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        AUTH_MESSAGES.USER_ALREADY_EXISTS,
      );
    const passwordHash = await bcrypt.hash(
      data.password,
      AUTH_CONSTANTS.SALT_ROUNDS,
    );
    try {
      return await authRepository.transaction(prisma, async (tx) => {
        const user = await authRepository.createUser(tx, { name: data.name });
        await authRepository.createAuthentication(tx, {
          provider,
          identifier,
          passwordHash,
          userId: user.id,
        });
        return this.createSession(tx, user);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          AUTH_MESSAGES.USER_ALREADY_EXISTS,
        );
      throw error;
    }
  }

  async refresh(rawToken?: string): Promise<SessionResult> {
    const { sessionId, token } = parseRefreshToken(rawToken);
    const session = await authRepository.findSession(prisma, sessionId);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.user.isActive
    )
      throw unauthorized();
    const previousHash = refreshHash(token);
    if (!hashesEqual(previousHash, session.refreshTokenHash)) {
      await authRepository.revokeSession(prisma, session.id);
      throw unauthorized();
    }
    const refreshToken = `${session.id}.${randomToken()}`;
    const rotated = await authRepository.rotateSession(
      prisma,
      session.id,
      previousHash,
      refreshHash(refreshToken),
    );
    if (rotated.count !== 1) {
      await authRepository.revokeSession(prisma, session.id);
      throw unauthorized();
    }
    return {
      user: safeUser(session.user),
      accessToken: accessToken(session.userId, session.id),
      refreshToken,
      accessMaxAge: durationMs(getEnv().ACCESS_TOKEN_EXPIRY),
      refreshMaxAge: Math.max(0, session.expiresAt.getTime() - Date.now()),
    };
  }

  async authenticate(token?: string) {
    const auth = verifyAccessToken(token);
    const session = await authRepository.findActiveSession(
      prisma,
      auth.sessionId,
      auth.userId,
    );
    if (!session) throw unauthorized();
    return auth;
  }

  async me(userId: string) {
    const user = await authRepository.findUser(prisma, userId);
    if (!user || !user.isActive) throw unauthorized();
    return { user: safeUser(user) };
  }

  async logout(refreshToken?: string, token?: string) {
    let sessionId: string | undefined;
    if (refreshToken) {
      try {
        const parsed = parseRefreshToken(refreshToken);
        const session = await authRepository.findSession(
          prisma,
          parsed.sessionId,
        );
        if (
          session &&
          hashesEqual(refreshHash(refreshToken), session.refreshTokenHash)
        )
          sessionId = session.id;
      } catch {
        /* Invalid cookies are still cleared by the controller. */
      }
    }
    if (!sessionId && token) {
      try {
        sessionId = verifyAccessToken(token).sessionId;
      } catch {
        /* An expired access cookie needs no further action. */
      }
    }
    if (sessionId) await authRepository.revokeSession(prisma, sessionId);
  }

  async forgotPassword(email: string) {
    const authentication = await authRepository.findAuthentication(
      prisma,
      AuthProvider.EMAIL,
      email,
    );
    if (!authentication || !authentication.user.isActive) return;
    const token = randomToken();
    const record = await authRepository.transaction(prisma, async (tx) => {
      await authRepository.lockUser(tx, authentication.userId);
      await authRepository.invalidatePasswordResets(tx, authentication.userId);
      return authRepository.createPasswordReset(tx, {
        userId: authentication.userId,
        tokenHash: resetHash(token),
        expiresAt: new Date(
          Date.now() + AUTH_CONSTANTS.PASSWORD_RESET_LIFETIME_MS,
        ),
      });
    });
    try {
      const link = new URL("/reset-password", getEnv().WEB_URL);
      link.searchParams.set("token", token);
      await mailer.send({
        to: email,
        subject: "Reset your DevFlow AI password",
        text: `Use this link to reset your password within 30 minutes:\n${link.toString()}\n\nIf you did not request this, you can ignore this email.`,
      });
    } catch {
      await authRepository.consumePasswordReset(prisma, record.id);
      logger.error(
        "Password reset email delivery failed; the unused reset token was invalidated",
      );
    }
  }

  async resetPassword(token: string, password: string) {
    const reset = await authRepository.findPasswordReset(
      prisma,
      resetHash(token),
    );
    if (
      !reset ||
      reset.usedAt ||
      reset.expiresAt.getTime() <= Date.now() ||
      !reset.user.isActive
    )
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, AUTH_MESSAGES.INVALID_RESET);
    const passwordHash = await bcrypt.hash(
      password,
      AUTH_CONSTANTS.SALT_ROUNDS,
    );
    await authRepository.transaction(prisma, async (tx) => {
      await authRepository.lockUser(tx, reset.userId);
      const consumed = await authRepository.consumePasswordReset(tx, reset.id);
      if (consumed.count !== 1)
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          AUTH_MESSAGES.INVALID_RESET,
        );
      await authRepository.updatePassword(tx, reset.userId, passwordHash);
      await authRepository.invalidatePasswordResets(tx, reset.userId);
      await authRepository.revokeUserSessions(tx, reset.userId);
    });
  }
}
export default new AuthService();
