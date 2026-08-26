import bcrypt from "bcrypt";

import { AuthProvider } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import authRepository from "./auth.repository";
import { RegisterRequest } from "./auth.validation";
import { ApiError } from "@/shared/errors/ApiError";
import { HTTP_STATUS } from "@/shared/constants/http-status";
import { AUTH_CONSTANTS, AUTH_MESSAGES } from "./auth.constants";

export interface RegisterResponse {
  user: {
    id: string;
    name: string;
  };

  accessToken: string;

  refreshToken: string;
}

class AuthService {
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const provider = data.email ? AuthProvider.EMAIL : AuthProvider.MOBILE;

    const identifier = data.email ?? data.mobileNumber!;

    const existing = await authRepository.findAuthentication(
      prisma,
      provider,
      identifier,
    );

    if (existing) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        AUTH_MESSAGES.USER_ALREADY_EXISTS,
      );
    }

    const passwordHash = await bcrypt.hash(
      data.password,
      AUTH_CONSTANTS.SALT_ROUNDS,
    );

    await prisma.$transaction(async (tx) => {
      const user = await authRepository.createUser(tx, {
        name: data.name,
      });

      await authRepository.createAuthentication(tx, {
        provider,
        identifier,
        passwordHash,
        userId: user.id,
      });
    });

    return {
      message: "User registered successfully",
    };
  }
}

export default new AuthService();
