-- HorseUp deal room: notification outbox and per-room opt-out.
ALTER TABLE "HuRoomMembership" ADD COLUMN "notificationsMutedAt" TIMESTAMP(3);

CREATE TYPE "HuNotificationKind" AS ENUM ('DOCUMENT_AVAILABLE', 'DOCUMENT_UPDATED', 'THREAD_REPLY', 'MENTION', 'ACCESS_ENDED', 'ADMIN_MESSAGE', 'ADMIN_INVITE_ACCEPTED', 'ADMIN_FIRST_VISIT');

CREATE TABLE "HuNotification" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "kind" "HuNotificationKind" NOT NULL,
    "actorId" TEXT,
    "documentId" TEXT,
    "documentVersionId" TEXT,
    "discussionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "outcome" TEXT,
    CONSTRAINT "HuNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HuNotification_teamId_processedAt_recipientEmail_createdAt_idx" ON "HuNotification"("teamId", "processedAt", "recipientEmail", "createdAt");
CREATE INDEX "HuNotification_roomId_teamId_idx" ON "HuNotification"("roomId", "teamId");
ALTER TABLE "HuNotification" ADD CONSTRAINT "HuNotification_roomId_teamId_fkey" FOREIGN KEY ("roomId", "teamId") REFERENCES "HuInvestorRoom"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuNotification" ADD CONSTRAINT "HuNotification_email_normalized" CHECK ("recipientEmail" = lower(btrim("recipientEmail")) AND length("recipientEmail") > 3);
ALTER TABLE "HuNotification" ADD CONSTRAINT "HuNotification_outcome_state" CHECK (("processedAt" IS NULL AND "outcome" IS NULL) OR ("processedAt" IS NOT NULL AND "outcome" IS NOT NULL AND "outcome" IN ('sent', 'skipped', 'failed')));
