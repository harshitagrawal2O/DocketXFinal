/*
  Warnings:

  - Added the required column `userColor` to the `DocumentMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userEmail` to the `DocumentMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userName` to the `DocumentMember` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_userId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentMember" DROP CONSTRAINT "DocumentMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Version" DROP CONSTRAINT "Version_createdByUserId_fkey";

-- AlterTable: add the new DocumentMember columns NULLABLE first — this
-- database already has rows (every test document created earlier this
-- session), so they need a backfill pass before becoming NOT NULL below.
ALTER TABLE "DocumentMember" ADD COLUMN     "userColor" TEXT,
ADD COLUMN     "userEmail" TEXT,
ADD COLUMN     "userName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "orgRole" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "anthropicApiKeyEnc" TEXT,
    "databaseUrlEnc" TEXT,
    "creditBalanceTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "invitedByName" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_organizationId_idx" ON "Invite"("organizationId");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: this database predates organizations — everything in it
-- becomes the bootstrap/default organization. No databaseUrlEnc is set, so
-- its tenant data (Document, DiffProposal, ...) keeps living on THIS same
-- database (see schema.prisma's header comment) — nothing physically moves.
INSERT INTO "Organization" ("id", "name", "slug", "creditBalanceTokens", "createdAt", "updatedAt")
VALUES ('bootstrap-org', 'Default Organization', 'default', 5000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Every pre-existing user becomes an admin of the bootstrap org — they were
-- all equal collaborators before organizations existed, so admin is the
-- non-destructive default (never silently strips access someone already had).
UPDATE "User" SET "organizationId" = 'bootstrap-org', "orgRole" = 'admin' WHERE "organizationId" IS NULL;

-- Backfill DocumentMember's new denormalized columns from the User rows that
-- still exist in this same database (the last moment a direct join is
-- possible — after this, tenant and control data can live in separate
-- physical databases and this join would no longer be expressible).
UPDATE "DocumentMember" dm
SET "userName" = u."name", "userEmail" = u."email", "userColor" = u."color"
FROM "User" u
WHERE dm."userId" = u."id" AND dm."userName" IS NULL;

-- Any DocumentMember row whose user no longer exists (orphaned test data)
-- gets a placeholder rather than blocking the NOT NULL constraint below.
UPDATE "DocumentMember"
SET "userName" = COALESCE("userName", 'Unknown user'),
    "userEmail" = COALESCE("userEmail", 'unknown@docket.local'),
    "userColor" = COALESCE("userColor", '#75777c')
WHERE "userName" IS NULL;

-- AlterTable: now that every row has a value, enforce NOT NULL.
ALTER TABLE "DocumentMember"
  ALTER COLUMN "userName" SET NOT NULL,
  ALTER COLUMN "userEmail" SET NOT NULL,
  ALTER COLUMN "userColor" SET NOT NULL;
