import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: [],
  });

// Reuse the pool across hot reloads and warm serverless invocations alike.
global.prisma = prisma;
