-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('EMAIL', 'MOBILE');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Authentication" (
    "id" TEXT NOT NULL,
    "provider" "public"."AuthProvider" NOT NULL,
    "identifier" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Authentication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Authentication_provider_identifier_key" ON "public"."Authentication"("provider", "identifier");

-- AddForeignKey
ALTER TABLE "public"."Authentication" ADD CONSTRAINT "Authentication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
