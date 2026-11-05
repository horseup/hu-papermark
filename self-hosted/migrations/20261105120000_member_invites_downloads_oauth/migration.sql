-- HorseUp deal room: investor-managed members, download log and OAuth storage for the MCP connector.
-- CreateEnum
CREATE TYPE "HuDownloadChannel" AS ENUM ('WEB', 'MCP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HuNotificationKind" ADD VALUE 'ADMIN_MEMBER_INVITED';
ALTER TYPE "HuNotificationKind" ADD VALUE 'ADMIN_MEMBER_REMOVED';

-- AlterTable
ALTER TABLE "HuRoomMembership" ADD COLUMN     "revokedById" TEXT;

-- AlterTable
ALTER TABLE "HuNotification" ADD COLUMN     "subjectEmail" TEXT;

-- CreateTable
CREATE TABLE "HuRoomDownload" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "bulk" BOOLEAN NOT NULL DEFAULT false,
    "channel" "HuDownloadChannel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuRoomDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuOAuthRecord" (
    "model" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "grantId" TEXT,
    "userCode" TEXT,
    "uid" TEXT,
    "accountId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuOAuthRecord_pkey" PRIMARY KEY ("model","id")
);

-- CreateIndex
CREATE INDEX "HuRoomDownload_roomId_createdAt_idx" ON "HuRoomDownload"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "HuRoomDownload_roomId_teamId_idx" ON "HuRoomDownload"("roomId", "teamId");

-- CreateIndex
CREATE INDEX "HuRoomDownload_userId_idx" ON "HuRoomDownload"("userId");

-- CreateIndex
CREATE INDEX "HuRoomDownload_documentId_teamId_idx" ON "HuRoomDownload"("documentId", "teamId");

-- CreateIndex
CREATE INDEX "HuRoomDownload_documentVersionId_documentId_idx" ON "HuRoomDownload"("documentVersionId", "documentId");

-- CreateIndex
CREATE INDEX "HuOAuthRecord_grantId_idx" ON "HuOAuthRecord"("grantId");

-- CreateIndex
CREATE INDEX "HuOAuthRecord_uid_idx" ON "HuOAuthRecord"("uid");

-- CreateIndex
CREATE INDEX "HuOAuthRecord_userCode_idx" ON "HuOAuthRecord"("userCode");

-- CreateIndex
CREATE INDEX "HuOAuthRecord_model_accountId_idx" ON "HuOAuthRecord"("model", "accountId");

-- CreateIndex
CREATE INDEX "HuOAuthRecord_expiresAt_idx" ON "HuOAuthRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "HuRoomMembership_revokedById_idx" ON "HuRoomMembership"("revokedById");

-- AddForeignKey
ALTER TABLE "HuRoomMembership" ADD CONSTRAINT "HuRoomMembership_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDownload" ADD CONSTRAINT "HuRoomDownload_roomId_teamId_fkey" FOREIGN KEY ("roomId", "teamId") REFERENCES "HuInvestorRoom"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDownload" ADD CONSTRAINT "HuRoomDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDownload" ADD CONSTRAINT "HuRoomDownload_documentId_teamId_fkey" FOREIGN KEY ("documentId", "teamId") REFERENCES "Document"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDownload" ADD CONSTRAINT "HuRoomDownload_documentVersionId_documentId_fkey" FOREIGN KEY ("documentVersionId", "documentId") REFERENCES "DocumentVersion"("id", "documentId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Same normalization rule as recipientEmail.
ALTER TABLE "HuNotification" ADD CONSTRAINT "HuNotification_subject_normalized" CHECK ("subjectEmail" IS NULL OR "subjectEmail" = lower(btrim("subjectEmail")));
