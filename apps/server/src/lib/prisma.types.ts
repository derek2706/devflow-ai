import { Prisma, PrismaClient } from "@prisma/client";

export type PrismaTransaction = Prisma.TransactionClient;

export type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;
