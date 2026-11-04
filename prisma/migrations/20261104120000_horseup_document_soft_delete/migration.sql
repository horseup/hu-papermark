-- HorseUp deal room: soft-deleted library documents.
ALTER TABLE "Document" ADD COLUMN "huDeletedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "huDeletedById" TEXT;
CREATE INDEX "Document_teamId_huDeletedAt_idx" ON "Document"("teamId", "huDeletedAt");
