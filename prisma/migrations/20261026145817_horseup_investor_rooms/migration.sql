-- CreateEnum
CREATE TYPE "HuDiscussionEventType" AS ENUM ('RESOLVED', 'REOPENED');

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "huS3VersionId" TEXT;

-- CreateTable
CREATE TABLE "HuRoomStage" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuRoomStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuDocumentAccess" (
    "documentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "minimumStageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuDocumentAccess_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "HuInvestorRoom" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuInvestorRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuRoomDocument" (
    "roomId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuRoomDocument_pkey" PRIMARY KEY ("roomId","documentId")
);

-- CreateTable
CREATE TABLE "HuRoomMembership" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "invitedById" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuRoomMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuRoomDiscussion" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentId" TEXT,
    "documentVersionId" TEXT,
    "pageNumber" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "HuRoomDiscussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuRoomMessage" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "HuRoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuRoomMention" (
    "messageId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuRoomMention_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "HuRoomDiscussionEvent" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "HuDiscussionEventType" NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuRoomDiscussionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuRoomVisit" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuRoomVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuPageReading" (
    "visitId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "visibleMs" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuPageReading_pkey" PRIMARY KEY ("visitId","documentVersionId","pageNumber")
);

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomStage_id_teamId_key" ON "HuRoomStage"("id", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomStage_teamId_position_key" ON "HuRoomStage"("teamId", "position");

-- CreateIndex
CREATE INDEX "HuDocumentAccess_minimumStageId_teamId_idx" ON "HuDocumentAccess"("minimumStageId", "teamId");

-- CreateIndex
CREATE INDEX "HuDocumentAccess_teamId_idx" ON "HuDocumentAccess"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "HuDocumentAccess_documentId_teamId_key" ON "HuDocumentAccess"("documentId", "teamId");

-- CreateIndex
CREATE INDEX "HuInvestorRoom_teamId_archivedAt_createdAt_idx" ON "HuInvestorRoom"("teamId", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "HuInvestorRoom_stageId_teamId_idx" ON "HuInvestorRoom"("stageId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "HuInvestorRoom_id_teamId_key" ON "HuInvestorRoom"("id", "teamId");

-- CreateIndex
CREATE INDEX "HuRoomDocument_documentId_teamId_idx" ON "HuRoomDocument"("documentId", "teamId");

-- CreateIndex
CREATE INDEX "HuRoomDocument_roomId_teamId_idx" ON "HuRoomDocument"("roomId", "teamId");

-- CreateIndex
CREATE INDEX "HuRoomMembership_userId_idx" ON "HuRoomMembership"("userId");

-- CreateIndex
CREATE INDEX "HuRoomMembership_invitedById_idx" ON "HuRoomMembership"("invitedById");

-- CreateIndex
CREATE INDEX "HuRoomMembership_email_revokedAt_idx" ON "HuRoomMembership"("email", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomMembership_roomId_email_key" ON "HuRoomMembership"("roomId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomMembership_roomId_userId_key" ON "HuRoomMembership"("roomId", "userId");

-- CreateIndex
CREATE INDEX "HuRoomDiscussion_roomId_resolvedAt_createdAt_id_idx" ON "HuRoomDiscussion"("roomId", "resolvedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "HuRoomDiscussion_roomId_teamId_idx" ON "HuRoomDiscussion"("roomId", "teamId");

-- CreateIndex
CREATE INDEX "HuRoomDiscussion_documentId_teamId_idx" ON "HuRoomDiscussion"("documentId", "teamId");

-- CreateIndex
CREATE INDEX "HuRoomDiscussion_documentVersionId_documentId_idx" ON "HuRoomDiscussion"("documentVersionId", "documentId");

-- CreateIndex
CREATE INDEX "HuRoomDiscussion_createdById_idx" ON "HuRoomDiscussion"("createdById");

-- CreateIndex
CREATE INDEX "HuRoomDiscussion_resolvedById_idx" ON "HuRoomDiscussion"("resolvedById");

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomDiscussion_id_roomId_key" ON "HuRoomDiscussion"("id", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomMessage_sequence_key" ON "HuRoomMessage"("sequence");

-- CreateIndex
CREATE INDEX "HuRoomMessage_discussionId_createdAt_sequence_idx" ON "HuRoomMessage"("discussionId", "createdAt", "sequence");

-- CreateIndex
CREATE INDEX "HuRoomMessage_discussionId_roomId_idx" ON "HuRoomMessage"("discussionId", "roomId");

-- CreateIndex
CREATE INDEX "HuRoomMessage_authorId_idx" ON "HuRoomMessage"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomMessage_id_roomId_key" ON "HuRoomMessage"("id", "roomId");

-- CreateIndex
CREATE INDEX "HuRoomMention_userId_createdAt_idx" ON "HuRoomMention"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HuRoomMention_messageId_roomId_idx" ON "HuRoomMention"("messageId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomDiscussionEvent_sequence_key" ON "HuRoomDiscussionEvent"("sequence");

-- CreateIndex
CREATE INDEX "HuRoomDiscussionEvent_discussionId_createdAt_sequence_idx" ON "HuRoomDiscussionEvent"("discussionId", "createdAt", "sequence");

-- CreateIndex
CREATE INDEX "HuRoomDiscussionEvent_discussionId_roomId_idx" ON "HuRoomDiscussionEvent"("discussionId", "roomId");

-- CreateIndex
CREATE INDEX "HuRoomDiscussionEvent_actorId_idx" ON "HuRoomDiscussionEvent"("actorId");

-- CreateIndex
CREATE INDEX "HuRoomVisit_roomId_startedAt_idx" ON "HuRoomVisit"("roomId", "startedAt");

-- CreateIndex
CREATE INDEX "HuRoomVisit_roomId_teamId_idx" ON "HuRoomVisit"("roomId", "teamId");

-- CreateIndex
CREATE INDEX "HuRoomVisit_userId_idx" ON "HuRoomVisit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HuRoomVisit_id_teamId_key" ON "HuRoomVisit"("id", "teamId");

-- CreateIndex
CREATE INDEX "HuPageReading_visitId_teamId_idx" ON "HuPageReading"("visitId", "teamId");

-- CreateIndex
CREATE INDEX "HuPageReading_documentId_teamId_idx" ON "HuPageReading"("documentId", "teamId");

-- CreateIndex
CREATE INDEX "HuPageReading_documentVersionId_documentId_idx" ON "HuPageReading"("documentVersionId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_id_teamId_key" ON "Document"("id", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_id_documentId_key" ON "DocumentVersion"("id", "documentId");

-- AddForeignKey
ALTER TABLE "HuRoomStage" ADD CONSTRAINT "HuRoomStage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuDocumentAccess" ADD CONSTRAINT "HuDocumentAccess_documentId_teamId_fkey" FOREIGN KEY ("documentId", "teamId") REFERENCES "Document"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuDocumentAccess" ADD CONSTRAINT "HuDocumentAccess_minimumStageId_teamId_fkey" FOREIGN KEY ("minimumStageId", "teamId") REFERENCES "HuRoomStage"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuInvestorRoom" ADD CONSTRAINT "HuInvestorRoom_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuInvestorRoom" ADD CONSTRAINT "HuInvestorRoom_stageId_teamId_fkey" FOREIGN KEY ("stageId", "teamId") REFERENCES "HuRoomStage"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDocument" ADD CONSTRAINT "HuRoomDocument_roomId_teamId_fkey" FOREIGN KEY ("roomId", "teamId") REFERENCES "HuInvestorRoom"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDocument" ADD CONSTRAINT "HuRoomDocument_documentId_teamId_fkey" FOREIGN KEY ("documentId", "teamId") REFERENCES "Document"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomMembership" ADD CONSTRAINT "HuRoomMembership_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HuInvestorRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomMembership" ADD CONSTRAINT "HuRoomMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomMembership" ADD CONSTRAINT "HuRoomMembership_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_roomId_teamId_fkey" FOREIGN KEY ("roomId", "teamId") REFERENCES "HuInvestorRoom"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_documentId_teamId_fkey" FOREIGN KEY ("documentId", "teamId") REFERENCES "Document"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_documentVersionId_documentId_fkey" FOREIGN KEY ("documentVersionId", "documentId") REFERENCES "DocumentVersion"("id", "documentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomMessage" ADD CONSTRAINT "HuRoomMessage_discussionId_roomId_fkey" FOREIGN KEY ("discussionId", "roomId") REFERENCES "HuRoomDiscussion"("id", "roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomMessage" ADD CONSTRAINT "HuRoomMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomMention" ADD CONSTRAINT "HuRoomMention_messageId_roomId_fkey" FOREIGN KEY ("messageId", "roomId") REFERENCES "HuRoomMessage"("id", "roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomMention" ADD CONSTRAINT "HuRoomMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDiscussionEvent" ADD CONSTRAINT "HuRoomDiscussionEvent_discussionId_roomId_fkey" FOREIGN KEY ("discussionId", "roomId") REFERENCES "HuRoomDiscussion"("id", "roomId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomDiscussionEvent" ADD CONSTRAINT "HuRoomDiscussionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomVisit" ADD CONSTRAINT "HuRoomVisit_roomId_teamId_fkey" FOREIGN KEY ("roomId", "teamId") REFERENCES "HuInvestorRoom"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuRoomVisit" ADD CONSTRAINT "HuRoomVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuPageReading" ADD CONSTRAINT "HuPageReading_visitId_teamId_fkey" FOREIGN KEY ("visitId", "teamId") REFERENCES "HuRoomVisit"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuPageReading" ADD CONSTRAINT "HuPageReading_documentId_teamId_fkey" FOREIGN KEY ("documentId", "teamId") REFERENCES "Document"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuPageReading" ADD CONSTRAINT "HuPageReading_documentVersionId_documentId_fkey" FOREIGN KEY ("documentVersionId", "documentId") REFERENCES "DocumentVersion"("id", "documentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants not expressible in the Prisma schema.
ALTER TABLE "HuRoomStage" ADD CONSTRAINT "HuRoomStage_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "HuRoomMembership" ADD CONSTRAINT "HuRoomMembership_email_normalized" CHECK ("email" = lower(btrim("email")) AND length("email") > 3);
ALTER TABLE "HuRoomMembership" ADD CONSTRAINT "HuRoomMembership_acceptance_user" CHECK ("acceptedAt" IS NULL OR "userId" IS NOT NULL);
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_resolution_pair" CHECK (("resolvedAt" IS NULL) = ("resolvedById" IS NULL));
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_document_context" CHECK (("documentId" IS NULL AND "documentVersionId" IS NULL AND "pageNumber" IS NULL) OR ("documentId" IS NOT NULL AND "documentVersionId" IS NOT NULL AND ("pageNumber" IS NULL OR "pageNumber" > 0)));
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_title_length" CHECK (length(btrim("title")) BETWEEN 1 AND 300);
ALTER TABLE "HuRoomMessage" ADD CONSTRAINT "HuRoomMessage_body_length" CHECK (length(btrim("body")) BETWEEN 1 AND 20000);

ALTER TABLE "HuPageReading" ADD CONSTRAINT "HuPageReading_bounds" CHECK ("pageNumber" > 0 AND "visibleMs" >= 0);