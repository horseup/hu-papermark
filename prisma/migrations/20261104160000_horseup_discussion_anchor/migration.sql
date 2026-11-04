-- HorseUp deal room: inline comment anchors on a document page.
ALTER TABLE "HuRoomDiscussion" ADD COLUMN "anchor" JSONB;
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_anchor_page" CHECK ("anchor" IS NULL OR ("pageNumber" IS NOT NULL AND jsonb_typeof("anchor") = 'object'));
