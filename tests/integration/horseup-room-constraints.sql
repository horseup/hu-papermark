-- Run against an isolated database with the core schema and HorseUp migration.
-- Fixture data is rolled back. This verifies database constraints, not UI flows.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO "User" (id,email) VALUES ('hu-test-admin','admin@example.test'),('hu-test-investor','investor@example.test');
INSERT INTO "Team" (id,name,"updatedAt","ignoredDomains","globalBlockList") VALUES
  ('hu-test-team','HorseUp test',now(),ARRAY[]::text[],ARRAY[]::text[]),
  ('hu-test-other','Other test',now(),ARRAY[]::text[],ARRAY[]::text[]);
INSERT INTO "HuRoomStage" (id,"teamId",name,position,"updatedAt") VALUES
  ('hu-test-stage','hu-test-team','Intro',0,now()),
  ('hu-test-foreign-stage','hu-test-other','Intro',0,now());
INSERT INTO "HuInvestorRoom" (id,"teamId",name,"stageId","updatedAt") VALUES
  ('hu-test-room-a','hu-test-team','A','hu-test-stage',now()),
  ('hu-test-room-b','hu-test-team','B','hu-test-stage',now());
INSERT INTO "Document" (id,name,file,"teamId","updatedAt") VALUES
  ('hu-test-document','Deck','test.pdf','hu-test-team',now()),
  ('hu-test-foreign-document','Other','other.pdf','hu-test-other',now());
INSERT INTO "DocumentVersion" (id,"versionNumber","documentId",file,"updatedAt") VALUES
  ('hu-test-version',1,'hu-test-document','test.pdf',now()),
  ('hu-test-foreign-version',1,'hu-test-foreign-document','other.pdf',now());
INSERT INTO "HuRoomDocument" ("roomId","documentId","teamId") VALUES ('hu-test-room-a','hu-test-document','hu-test-team');
INSERT INTO "HuRoomMembership" (id,"roomId",email,"userId","invitedById","acceptedAt","updatedAt")
VALUES ('hu-test-member','hu-test-room-a','investor@example.test','hu-test-investor','hu-test-admin',now(),now());
INSERT INTO "HuRoomDiscussion" (id,"roomId","teamId",title,"documentId","documentVersionId","pageNumber","createdById","updatedAt")
VALUES ('hu-test-discussion','hu-test-room-a','hu-test-team','Question','hu-test-document','hu-test-version',1,'hu-test-investor',now());
INSERT INTO "HuRoomMessage" (id,"discussionId","roomId","authorId",body) VALUES
  ('hu-test-message-1','hu-test-discussion','hu-test-room-a','hu-test-investor','First'),
  ('hu-test-message-2','hu-test-discussion','hu-test-room-a','hu-test-admin','Second');

DO $$
DECLARE first_sequence bigint; second_sequence bigint;
BEGIN
  SELECT sequence INTO first_sequence FROM "HuRoomMessage" WHERE id='hu-test-message-1';
  SELECT sequence INTO second_sequence FROM "HuRoomMessage" WHERE id='hu-test-message-2';
  IF NOT first_sequence < second_sequence THEN RAISE EXCEPTION 'Message ordering failed'; END IF;

  BEGIN
    UPDATE "HuInvestorRoom" SET "stageId"='hu-test-foreign-stage' WHERE id='hu-test-room-a';
    RAISE EXCEPTION 'Cross-team stage unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO "HuRoomDocument" ("roomId","documentId","teamId") VALUES ('hu-test-room-a','hu-test-foreign-document','hu-test-team');
    RAISE EXCEPTION 'Cross-team document unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO "HuRoomMessage" (id,"discussionId","roomId","authorId",body) VALUES ('hu-test-bad-message','hu-test-discussion','hu-test-room-b','hu-test-admin','Wrong room');
    RAISE EXCEPTION 'Cross-room message unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    UPDATE "HuRoomDiscussion" SET "documentVersionId"='hu-test-foreign-version' WHERE id='hu-test-discussion';
    RAISE EXCEPTION 'Foreign document version unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    UPDATE "HuRoomMembership" SET email='INVESTOR@example.test' WHERE id='hu-test-member';
    RAISE EXCEPTION 'Unnormalized invitation unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "HuRoomDiscussion" SET "resolvedAt"=now() WHERE id='hu-test-discussion';
    RAISE EXCEPTION 'Resolution without actor unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "HuRoomDiscussion" SET "pageNumber"=0 WHERE id='hu-test-discussion';
    RAISE EXCEPTION 'Invalid page unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "HuRoomStage" SET position=-1 WHERE id='hu-test-stage';
    RAISE EXCEPTION 'Negative stage unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'HorseUp database constraints passed';
END $$;
ROLLBACK;
