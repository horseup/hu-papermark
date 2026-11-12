-- HorseUp deal room: one shared folder tree, document placement and upload thumbnails.

CREATE TABLE "HuFolder" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuFolder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HuFolder_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 120 AND "name" = btrim("name")),
    CONSTRAINT "HuFolder_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id")
);

CREATE UNIQUE INDEX "HuFolder_id_teamId_key" ON "HuFolder"("id", "teamId");
CREATE INDEX "HuFolder_teamId_parentId_idx" ON "HuFolder"("teamId", "parentId");
CREATE INDEX "HuFolder_parentId_teamId_idx" ON "HuFolder"("parentId", "teamId");
-- Sibling names are unique regardless of case, at the top level and inside each folder.
CREATE UNIQUE INDEX "HuFolder_top_level_name_key" ON "HuFolder"("teamId", lower("name")) WHERE "parentId" IS NULL;
CREATE UNIQUE INDEX "HuFolder_sibling_name_key" ON "HuFolder"("teamId", "parentId", lower("name")) WHERE "parentId" IS NOT NULL;

ALTER TABLE "HuFolder" ADD CONSTRAINT "HuFolder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuFolder" ADD CONSTRAINT "HuFolder_parentId_teamId_fkey" FOREIGN KEY ("parentId", "teamId") REFERENCES "HuFolder"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HuDocumentFolder" (
    "documentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuDocumentFolder_pkey" PRIMARY KEY ("documentId")
);

CREATE UNIQUE INDEX "HuDocumentFolder_documentId_teamId_key" ON "HuDocumentFolder"("documentId", "teamId");
CREATE INDEX "HuDocumentFolder_folderId_teamId_idx" ON "HuDocumentFolder"("folderId", "teamId");
CREATE INDEX "HuDocumentFolder_teamId_idx" ON "HuDocumentFolder"("teamId");

ALTER TABLE "HuDocumentFolder" ADD CONSTRAINT "HuDocumentFolder_documentId_teamId_fkey" FOREIGN KEY ("documentId", "teamId") REFERENCES "Document"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuDocumentFolder" ADD CONSTRAINT "HuDocumentFolder_folderId_teamId_fkey" FOREIGN KEY ("folderId", "teamId") REFERENCES "HuFolder"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion" ADD COLUMN "huThumbnailFile" TEXT;
ALTER TABLE "DocumentVersion" ADD COLUMN "huThumbnailS3VersionId" TEXT;
