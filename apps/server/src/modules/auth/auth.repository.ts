import { AuthProvider } from "@prisma/client";

import { PrismaDB } from "@/lib/prisma.types";

class AuthRepository {
  async findAuthentication(
    db: PrismaDB,
    provider: AuthProvider,
    identifier: string,
  ) {
    return db.authentication.findUnique({
      where: {
        provider_identifier: {
          provider,
          identifier,
        },
      },
    });
  }

  async createUser(
    db: PrismaDB,
    data: {
      name: string;
      avatar?: string;
    },
  ) {
    return db.user.create({
      data,
    });
  }

  async createAuthentication(
    db: PrismaDB,
    data: {
      provider: AuthProvider;
      identifier: string;
      passwordHash: string;
      userId: string;
    },
  ) {
    return db.authentication.create({
      data,
    });
  }
}

export default new AuthRepository();
