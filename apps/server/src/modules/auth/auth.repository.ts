import { AuthProvider, Prisma, PrismaClient } from "@prisma/client";
import { PrismaClientOrTransaction } from "../../lib/prisma.types";

class AuthRepository {
  transaction<T>(
    db: PrismaClient,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    return db.$transaction(operation);
  }
  async lockUser(db: PrismaClientOrTransaction, userId: string) {
    // Login and password reset take the same row lock before changing sessions.
    // Prisma's SQL template parameterizes the user ID.
    await db.$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
    );
  }
  findAuthentication(
    db: PrismaClientOrTransaction,
    provider: AuthProvider,
    identifier: string,
  ) {
    return db.authentication.findUnique({
      where: { provider_identifier: { provider, identifier } },
      include: { user: true },
    });
  }
  findUser(db: PrismaClientOrTransaction, id: string) {
    return db.user.findUnique({ where: { id } });
  }
  createUser(
    db: PrismaClientOrTransaction,
    data: { name: string; avatar?: string },
  ) {
    return db.user.create({ data });
  }
  createAuthentication(
    db: PrismaClientOrTransaction,
    data: {
      provider: AuthProvider;
      identifier: string;
      passwordHash: string;
      userId: string;
    },
  ) {
    return db.authentication.create({ data });
  }
  createSession(
    db: PrismaClientOrTransaction,
    data: {
      id: string;
      userId: string;
      refreshTokenHash: string;
      expiresAt: Date;
    },
  ) {
    return db.session.create({ data });
  }
  findSession(db: PrismaClientOrTransaction, id: string) {
    return db.session.findUnique({ where: { id }, include: { user: true } });
  }
  findActiveSession(db: PrismaClientOrTransaction, id: string, userId: string) {
    return db.session.findUnique({
      where: {
        id,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { isActive: true },
      },
      select: { id: true },
    });
  }
  rotateSession(
    db: PrismaClientOrTransaction,
    id: string,
    previousHash: string,
    nextHash: string,
  ) {
    return db.session.updateMany({
      where: {
        id,
        refreshTokenHash: previousHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { refreshTokenHash: nextHash },
    });
  }
  revokeSession(db: PrismaClientOrTransaction, id: string) {
    return db.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  revokeUserSessions(db: PrismaClientOrTransaction, userId: string) {
    return db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  createPasswordReset(
    db: PrismaClientOrTransaction,
    data: { userId: string; tokenHash: string; expiresAt: Date },
  ) {
    return db.passwordReset.create({ data });
  }
  findPasswordReset(db: PrismaClientOrTransaction, tokenHash: string) {
    return db.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }
  consumePasswordReset(db: PrismaClientOrTransaction, id: string) {
    return db.passwordReset.updateMany({
      where: { id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
  }
  invalidatePasswordResets(db: PrismaClientOrTransaction, userId: string) {
    return db.passwordReset.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
  updatePassword(
    db: PrismaClientOrTransaction,
    userId: string,
    passwordHash: string,
  ) {
    return db.authentication.updateMany({
      where: { userId },
      data: { passwordHash },
    });
  }
}
export default new AuthRepository();
