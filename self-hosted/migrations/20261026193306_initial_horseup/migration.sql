-- CreateEnum
CREATE TYPE "ConversationVisibility" AS ENUM ('PRIVATE', 'PUBLIC_LINK', 'PUBLIC_GROUP', 'PUBLIC_DOCUMENT', 'PUBLIC_DATAROOM');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('OWNER', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "FaqVisibility" AS ENUM ('PUBLIC_DATAROOM', 'PUBLIC_LINK', 'PUBLIC_DOCUMENT');

-- CreateEnum
CREATE TYPE "FaqStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('DATAROOM_DOCUMENT', 'DATAROOM_FOLDER');

-- CreateEnum
CREATE TYPE "DefaultPermissionStrategy" AS ENUM ('INHERIT_FROM_PARENT', 'ASK_EVERY_TIME', 'HIDDEN_BY_DEFAULT');

-- CreateEnum
CREATE TYPE "RootItemAccess" AS ENUM ('VIEW_ONLY', 'VIEW_AND_DOWNLOAD', 'HIDDEN');

-- CreateEnum
CREATE TYPE "DocumentStorageType" AS ENUM ('S3_PATH', 'VERCEL_BLOB');

-- CreateEnum
CREATE TYPE "HuDiscussionEventType" AS ENUM ('RESOLVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('DOCUMENT_LINK', 'DATAROOM_LINK', 'WORKFLOW_LINK');

-- CreateEnum
CREATE TYPE "LinkAudienceType" AS ENUM ('GENERAL', 'GROUP', 'TEAM');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'PHONE_NUMBER', 'URL', 'CHECKBOX', 'SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "ReferralTrack" AS ENUM ('AFFILIATE', 'PARTNER_DISCOUNT');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('DOCUMENT_VIEW', 'DATAROOM_VIEW');

-- CreateEnum
CREATE TYPE "DownloadType" AS ENUM ('SINGLE', 'BULK', 'FOLDER');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('FIRST_DAY_DOMAIN_REMINDER_EMAIL', 'FIRST_DOMAIN_INVALID_EMAIL', 'SECOND_DOMAIN_INVALID_EMAIL', 'FIRST_TRIAL_END_REMINDER_EMAIL', 'FINAL_TRIAL_END_REMINDER_EMAIL');

-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('LINK_TAG', 'DOCUMENT_TAG', 'DATAROOM_TAG');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('SENT', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER', 'DATAROOM_MEMBER');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('ROUTER');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED');

-- CreateTable
CREATE TABLE "DocumentAnnotation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "pages" INTEGER[],
    "documentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationImage" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,
    "annotationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnotationImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "logo" TEXT,
    "hideLogo" BOOLEAN NOT NULL DEFAULT false,
    "banner" TEXT,
    "brandColor" TEXT,
    "accentColor" TEXT,
    "accentButtonColor" TEXT,
    "applyAccentColorToDataroomView" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMessage" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "privacyPolicyUrl" TEXT,
    "cardLayout" TEXT NOT NULL DEFAULT 'LIST',
    "showFolderTree" BOOLEAN NOT NULL DEFAULT true,
    "viewerLayoutPreset" TEXT NOT NULL DEFAULT 'STANDARD',
    "viewerHeaderStyle" TEXT NOT NULL DEFAULT 'DEFAULT',
    "hideFolderIconsInMain" BOOLEAN NOT NULL DEFAULT false,
    "customLinkPreviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linkPreviewTitle" TEXT,
    "linkPreviewDescription" TEXT,
    "linkPreviewImage" TEXT,
    "linkPreviewFavicon" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "name" TEXT NOT NULL DEFAULT 'Default',
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "visibilityMode" "ConversationVisibility" NOT NULL DEFAULT 'PRIVATE',
    "dataroomId" TEXT NOT NULL,
    "dataroomDocumentId" TEXT,
    "documentVersionNumber" INTEGER,
    "documentPageNumber" INTEGER,
    "linkId" TEXT,
    "viewerGroupId" TEXT,
    "questionId" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'visitor',
    "category" TEXT,
    "priority" TEXT,
    "recipientViewerId" TEXT,
    "initialViewId" TEXT,
    "teamId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataroomQuestion" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unanswered',
    "orderIndex" INTEGER,
    "importBatchId" TEXT,
    "dataroomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "dataroomDocumentId" TEXT,
    "documentPageNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataroomQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataroomQuestionAssignment" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "linkId" TEXT,
    "groupId" TEXT,
    "viewerId" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataroomQuestionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "viewerId" TEXT,
    "userId" TEXT,
    "receiveNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "viewerId" TEXT,
    "viewId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationView" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataroomFaqItem" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "editedQuestion" TEXT NOT NULL,
    "originalQuestion" TEXT,
    "answer" TEXT NOT NULL,
    "description" TEXT,
    "dataroomId" TEXT NOT NULL,
    "linkId" TEXT,
    "dataroomDocumentId" TEXT,
    "sourceConversationId" TEXT,
    "questionMessageId" TEXT,
    "answerMessageId" TEXT,
    "teamId" TEXT NOT NULL,
    "publishedByUserId" TEXT NOT NULL,
    "visibilityMode" "FaqVisibility" NOT NULL DEFAULT 'PUBLIC_DATAROOM',
    "status" "FaqStatus" NOT NULL DEFAULT 'PUBLISHED',
    "isAnonymized" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documentPageNumber" INTEGER,
    "documentVersionNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataroomFaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataroom" (
    "id" TEXT NOT NULL,
    "pId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT,
    "description" TEXT,
    "teamId" TEXT NOT NULL,
    "brandId" TEXT,
    "conversationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "agentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vectorStoreId" TEXT,
    "requestListEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enableChangeNotifications" BOOLEAN NOT NULL DEFAULT false,
    "enableVisitorUploadChangeNotifications" BOOLEAN NOT NULL DEFAULT false,
    "defaultPermissionStrategy" "DefaultPermissionStrategy" NOT NULL DEFAULT 'INHERIT_FROM_PARENT',
    "defaultShowBanner" BOOLEAN NOT NULL DEFAULT true,
    "defaultGroupPermissionStrategy" "DefaultPermissionStrategy" NOT NULL DEFAULT 'INHERIT_FROM_PARENT',
    "defaultRootItemAccess" "RootItemAccess" NOT NULL DEFAULT 'VIEW_ONLY',
    "defaultGroupRootItemAccess" "RootItemAccess" NOT NULL DEFAULT 'VIEW_ONLY',
    "allowBulkDownload" BOOLEAN NOT NULL DEFAULT true,
    "showLastUpdated" BOOLEAN NOT NULL DEFAULT true,
    "introductionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "introductionContent" JSONB,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenAt" TIMESTAMP(3),
    "frozenBy" TEXT,
    "freezeArchiveUrl" TEXT,
    "freezeArchiveHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dataroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER,
    "dataroomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TODO',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "category" TEXT,
    "dueDate" TIMESTAMP(3),
    "orderIndex" INTEGER,
    "taskListId" TEXT NOT NULL,
    "dataroomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "uploadFolderId" TEXT,
    "createdByUserId" TEXT,
    "lastActivityNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "viewerId" TEXT,
    "groupId" TEXT,
    "linkId" TEXT,
    "email" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "comment" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "userId" TEXT,
    "viewerId" TEXT,
    "viewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataroomDocument" (
    "id" TEXT NOT NULL,
    "dataroomId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "folderId" TEXT,
    "orderIndex" INTEGER,
    "hierarchicalIndex" TEXT,
    "vectorStoreFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataroomDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataroomFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "parentId" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "dataroomId" TEXT NOT NULL,
    "orderIndex" INTEGER,
    "hierarchicalIndex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataroomFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataroomBrand" (
    "id" TEXT NOT NULL,
    "logo" TEXT,
    "hideLogo" BOOLEAN,
    "banner" TEXT,
    "brandColor" TEXT,
    "accentColor" TEXT,
    "accentButtonColor" TEXT,
    "applyAccentColorToDataroomView" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMessage" TEXT,
    "cardLayout" TEXT NOT NULL DEFAULT 'LIST',
    "showFolderTree" BOOLEAN NOT NULL DEFAULT true,
    "viewerLayoutPreset" TEXT NOT NULL DEFAULT 'STANDARD',
    "viewerHeaderStyle" TEXT NOT NULL DEFAULT 'DEFAULT',
    "hideFolderIconsInMain" BOOLEAN NOT NULL DEFAULT false,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "customLinkPreviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linkPreviewTitle" TEXT,
    "linkPreviewDescription" TEXT,
    "linkPreviewImage" TEXT,
    "linkPreviewFavicon" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "dataroomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataroomBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domains" TEXT[],
    "allowAll" BOOLEAN NOT NULL DEFAULT false,
    "dataroomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerGroupMembership" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerGroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerGroupAccessControls" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canDownload" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerGroupAccessControls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataroomId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGroupAccessControls" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canDownload" BOOLEAN NOT NULL DEFAULT false,
    "canDownloadOriginal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionGroupAccessControls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file" TEXT NOT NULL,
    "originalFile" TEXT,
    "type" TEXT,
    "contentType" TEXT,
    "storageType" "DocumentStorageType" NOT NULL DEFAULT 'VERCEL_BLOB',
    "numPages" INTEGER,
    "teamId" TEXT NOT NULL,
    "ownerId" TEXT,
    "assistantEnabled" BOOLEAN NOT NULL DEFAULT false,
    "advancedExcelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "agentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "downloadOnly" BOOLEAN NOT NULL DEFAULT false,
    "hiddenInAllDocuments" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "folderId" TEXT,
    "isExternalUpload" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "huS3VersionId" TEXT,
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "documentId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "originalFile" TEXT,
    "type" TEXT,
    "contentType" TEXT,
    "fileSize" BIGINT,
    "storageType" "DocumentStorageType" NOT NULL DEFAULT 'VERCEL_BLOB',
    "numPages" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVertical" BOOLEAN NOT NULL DEFAULT false,
    "fileId" TEXT,
    "vectorStoreFileId" TEXT,
    "hasPages" BOOLEAN NOT NULL DEFAULT false,
    "length" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPage" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "embeddedLinks" TEXT[],
    "pageLinks" JSONB,
    "metadata" JSONB,
    "file" TEXT NOT NULL,
    "storageType" "DocumentStorageType" NOT NULL DEFAULT 'VERCEL_BLOB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "parentId" TEXT,
    "hiddenInAllDocuments" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT,
    "color" TEXT,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentUpload" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "viewerId" TEXT,
    "viewId" TEXT,
    "linkId" TEXT NOT NULL,
    "dataroomId" TEXT,
    "dataroomDocumentId" TEXT,
    "taskId" TEXT,
    "originalFilename" TEXT,
    "fileSize" BIGINT,
    "numPages" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingDocumentUpload" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageType" "DocumentStorageType" NOT NULL DEFAULT 'S3_PATH',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingDocumentUpload_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "readme" TEXT,
    "developer" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "logo" TEXT,
    "screenshots" JSONB,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "installUrl" TEXT,
    "category" TEXT,
    "comingSoon" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstalledIntegration" (
    "id" TEXT NOT NULL,
    "credentials" JSONB,
    "configuration" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "integrationId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstalledIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jackson_index" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "storeKey" TEXT NOT NULL,

    CONSTRAINT "jackson_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jackson_store" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "iv" TEXT,
    "tag" TEXT,
    "namespace" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedAt" TIMESTAMP(0),

    CONSTRAINT "jackson_store_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "jackson_ttl" (
    "key" TEXT NOT NULL,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "jackson_ttl_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "dataroomId" TEXT,
    "linkType" "LinkType" NOT NULL DEFAULT 'DOCUMENT_LINK',
    "url" TEXT,
    "name" TEXT,
    "slug" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "allowList" TEXT[],
    "denyList" TEXT[],
    "emailProtected" BOOLEAN NOT NULL DEFAULT true,
    "emailAuthenticated" BOOLEAN NOT NULL DEFAULT false,
    "allowDownload" BOOLEAN DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "domainId" TEXT,
    "domainSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enableNotification" BOOLEAN DEFAULT true,
    "enableFeedback" BOOLEAN DEFAULT false,
    "enableQuestion" BOOLEAN DEFAULT false,
    "enableScreenshotProtection" BOOLEAN DEFAULT false,
    "enableConfidentialView" BOOLEAN DEFAULT false,
    "enableAgreement" BOOLEAN DEFAULT false,
    "agreementId" TEXT,
    "showBanner" BOOLEAN DEFAULT false,
    "enableWatermark" BOOLEAN DEFAULT false,
    "watermarkConfig" JSONB,
    "audienceType" "LinkAudienceType" NOT NULL DEFAULT 'GENERAL',
    "groupId" TEXT,
    "permissionGroupId" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "metaImage" TEXT,
    "metaFavicon" TEXT,
    "enableCustomMetatag" BOOLEAN DEFAULT false,
    "welcomeMessage" TEXT,
    "enableConversation" BOOLEAN NOT NULL DEFAULT false,
    "enableAIAgents" BOOLEAN DEFAULT false,
    "enableUpload" BOOLEAN DEFAULT false,
    "isFileRequestOnly" BOOLEAN DEFAULT false,
    "uploadFolderId" TEXT,
    "uploadFolderIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enableIndexFile" BOOLEAN DEFAULT false,
    "teamId" TEXT,
    "brandId" TEXT,
    "ownerId" TEXT,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "pId" TEXT,
    "enableCustomMetaTag" BOOLEAN DEFAULT false,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "metaImage" TEXT,
    "metaFavicon" TEXT,
    "enableNotification" BOOLEAN DEFAULT false,
    "emailProtected" BOOLEAN DEFAULT true,
    "emailAuthenticated" BOOLEAN DEFAULT false,
    "allowDownload" BOOLEAN DEFAULT false,
    "enableAllowList" BOOLEAN DEFAULT false,
    "allowList" TEXT[],
    "enableDenyList" BOOLEAN DEFAULT false,
    "denyList" TEXT[],
    "expiresIn" INTEGER,
    "enableScreenshotProtection" BOOLEAN DEFAULT false,
    "enableConfidentialView" BOOLEAN DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "enablePassword" BOOLEAN DEFAULT false,
    "password" TEXT,
    "enableWatermark" BOOLEAN DEFAULT false,
    "watermarkConfig" JSONB,
    "enableAgreement" BOOLEAN DEFAULT false,
    "agreementId" TEXT,
    "enableCustomFields" BOOLEAN DEFAULT false,
    "customFields" JSONB,
    "showBanner" BOOLEAN DEFAULT false,
    "welcomeMessage" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emails" TEXT[],
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkVisitorGroup" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "visitorGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkVisitorGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "linkId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldResponse" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "viewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'IMMEDIATE',
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientUri" TEXT,
    "logoUri" TEXT,
    "redirectUris" TEXT[],
    "grantTypes" TEXT[],
    "scopes" TEXT NOT NULL,
    "tokenAuthMethod" TEXT NOT NULL,
    "hashedSecret" TEXT,
    "registrationType" TEXT NOT NULL,
    "metadataUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthClientApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "clientMetadataHash" TEXT,

    CONSTRAINT "OAuthClientApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthGrantTeam" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthGrantTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthRecord" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "grantId" TEXT,
    "userCode" TEXT,
    "uid" TEXT,
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRedactionJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "customTerms" TEXT[],
    "reasons" TEXT[],
    "resultVersionId" TEXT,
    "error" TEXT,
    "detectRunId" TEXT,
    "applyRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRedactionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRedaction" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "textPreview" TEXT,
    "category" TEXT,
    "confidence" TEXT,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AI',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRedaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralInvite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "scopeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "referralLink" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripeId" TEXT,
    "subscriptionId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "referralTrack" "ReferralTrack",
    "referralTrackSelectedAt" TIMESTAMP(3),
    "referralProfile" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "redirectUrl" TEXT,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "View" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "documentId" TEXT,
    "dataroomId" TEXT,
    "dataroomViewId" TEXT,
    "viewerEmail" TEXT,
    "viewerName" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMP(3),
    "downloadType" "DownloadType",
    "downloadMetadata" JSONB,
    "viewType" "ViewType" NOT NULL DEFAULT 'DOCUMENT_VIEW',
    "viewerId" TEXT,
    "groupId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,

    CONSTRAINT "View_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viewer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "invitedAt" TIMESTAMP(3),
    "notificationPreferences" JSONB,
    "dataroomId" TEXT,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Viewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "email" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "dataroomIds" TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- CreateTable
CREATE TABLE "SentEmail" (
    "id" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "domainSlug" TEXT,

    CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "teamId" TEXT NOT NULL,
    "documentId" TEXT,
    "dataroomId" TEXT,
    "linkId" TEXT,
    "viewId" TEXT,
    "userId" TEXT,
    "viewerId" TEXT,
    "vectorStoreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackResponse" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "viewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'LINK',
    "signingProvider" TEXT NOT NULL DEFAULT 'LEGACY',
    "signingExternalId" TEXT,
    "signingEnvelopeId" TEXT,
    "signingTemplateId" TEXT,
    "requireName" BOOLEAN NOT NULL DEFAULT true,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementResponse" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "viewId" TEXT,
    "linkId" TEXT,
    "signerEmail" TEXT,
    "signerName" TEXT,
    "signingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "signingExternalId" TEXT,
    "signingEnvelopeId" TEXT,
    "signingDocumentId" INTEGER,
    "signedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "signedFileKey" TEXT,
    "signedFileName" TEXT,
    "signedFileStorageType" "DocumentStorageType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingWebhook" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT,
    "source" TEXT,
    "actions" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomingWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestrictedToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "partialKey" TEXT NOT NULL,
    "scopes" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'live',
    "source" TEXT NOT NULL DEFAULT 'dashboard',
    "subjectType" TEXT NOT NULL DEFAULT 'user',
    "clientId" TEXT,
    "expires" TIMESTAMP(3),
    "lastUsed" TIMESTAMP(3),
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestrictedToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "pId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "triggers" JSONB NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YearInReview" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempted" TIMESTAMP(3),
    "error" TEXT,
    "stats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearInReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT,
    "teamId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagItem" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "itemType" "TagType" NOT NULL,
    "linkId" TEXT,
    "documentId" TEXT,
    "dataroomId" TEXT,
    "taggedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerInvitation" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "groupId" TEXT,
    "invitedBy" TEXT NOT NULL,
    "customMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "InvitationStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewerInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "defaultBrandId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripeId" TEXT,
    "subscriptionId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pauseStartsAt" TIMESTAMP(3),
    "pauseEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "trialReminderRunId" TEXT,
    "trialExpiredRunId" TEXT,
    "limits" JSONB,
    "enableExcelAdvancedMode" BOOLEAN NOT NULL DEFAULT false,
    "replicateDataroomFolders" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Etc/UTC',
    "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ssoEmailDomain" TEXT,
    "ssoEnforcedAt" TIMESTAMP(3),
    "surveyData" JSONB,
    "agentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vectorStoreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ignoredDomains" TEXT[],
    "globalBlockList" TEXT[],
    "referralTrack" "ReferralTrack",
    "referralTrackSelectedAt" TIMESTAMP(3),
    "referralProfile" JSONB,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDataroom" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "dataroomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDataroom_pkey" PRIMARY KEY ("userId","dataroomId")
);

-- CreateTable
CREATE TABLE "UserTeam" (
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "blockedAt" TIMESTAMP(3),
    "notificationPreferences" JSONB,

    CONSTRAINT "UserTeam_pkey" PRIMARY KEY ("userId","teamId")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entryLinkId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepType" "WorkflowStepType" NOT NULL DEFAULT 'ROUTER',
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "visitorEmail" TEXT,
    "visitorIp" TEXT,
    "status" "ExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "metadata" JSONB,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStepLog" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "workflowStepId" TEXT NOT NULL,
    "conditionsMatched" BOOLEAN NOT NULL,
    "conditionResults" JSONB,
    "actionsExecuted" JSONB,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "error" TEXT,

    CONSTRAINT "WorkflowStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAnnotation_documentId_idx" ON "DocumentAnnotation"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAnnotation_teamId_idx" ON "DocumentAnnotation"("teamId");

-- CreateIndex
CREATE INDEX "DocumentAnnotation_createdById_idx" ON "DocumentAnnotation"("createdById");

-- CreateIndex
CREATE INDEX "AnnotationImage_annotationId_idx" ON "AnnotationImage"("annotationId");

-- CreateIndex
CREATE INDEX "Brand_teamId_idx" ON "Brand"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_teamId_name_key" ON "Brand"("teamId", "name");

-- CreateIndex
CREATE INDEX "Conversation_dataroomId_idx" ON "Conversation"("dataroomId");

-- CreateIndex
CREATE INDEX "Conversation_dataroomDocumentId_idx" ON "Conversation"("dataroomDocumentId");

-- CreateIndex
CREATE INDEX "Conversation_linkId_idx" ON "Conversation"("linkId");

-- CreateIndex
CREATE INDEX "Conversation_teamId_idx" ON "Conversation"("teamId");

-- CreateIndex
CREATE INDEX "Conversation_viewerGroupId_idx" ON "Conversation"("viewerGroupId");

-- CreateIndex
CREATE INDEX "Conversation_initialViewId_idx" ON "Conversation"("initialViewId");

-- CreateIndex
CREATE INDEX "Conversation_questionId_idx" ON "Conversation"("questionId");

-- CreateIndex
CREATE INDEX "Conversation_recipientViewerId_idx" ON "Conversation"("recipientViewerId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_questionId_recipientViewerId_key" ON "Conversation"("questionId", "recipientViewerId");

-- CreateIndex
CREATE INDEX "DataroomQuestion_dataroomId_idx" ON "DataroomQuestion"("dataroomId");

-- CreateIndex
CREATE INDEX "DataroomQuestion_teamId_idx" ON "DataroomQuestion"("teamId");

-- CreateIndex
CREATE INDEX "DataroomQuestion_status_idx" ON "DataroomQuestion"("status");

-- CreateIndex
CREATE INDEX "DataroomQuestion_importBatchId_idx" ON "DataroomQuestion"("importBatchId");

-- CreateIndex
CREATE INDEX "DataroomQuestion_dataroomDocumentId_idx" ON "DataroomQuestion"("dataroomDocumentId");

-- CreateIndex
CREATE INDEX "DataroomQuestion_createdByUserId_idx" ON "DataroomQuestion"("createdByUserId");

-- CreateIndex
CREATE INDEX "DataroomQuestionAssignment_questionId_idx" ON "DataroomQuestionAssignment"("questionId");

-- CreateIndex
CREATE INDEX "DataroomQuestionAssignment_linkId_idx" ON "DataroomQuestionAssignment"("linkId");

-- CreateIndex
CREATE INDEX "DataroomQuestionAssignment_groupId_idx" ON "DataroomQuestionAssignment"("groupId");

-- CreateIndex
CREATE INDEX "DataroomQuestionAssignment_viewerId_idx" ON "DataroomQuestionAssignment"("viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "DataroomQuestionAssignment_questionId_linkId_key" ON "DataroomQuestionAssignment"("questionId", "linkId");

-- CreateIndex
CREATE UNIQUE INDEX "DataroomQuestionAssignment_questionId_groupId_key" ON "DataroomQuestionAssignment"("questionId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "DataroomQuestionAssignment_questionId_viewerId_key" ON "DataroomQuestionAssignment"("questionId", "viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "DataroomQuestionAssignment_questionId_email_key" ON "DataroomQuestionAssignment"("questionId", "email");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_viewerId_idx" ON "ConversationParticipant"("viewerId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_viewerId_key" ON "ConversationParticipant"("conversationId", "viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE INDEX "Message_viewerId_idx" ON "Message"("viewerId");

-- CreateIndex
CREATE INDEX "Message_viewId_idx" ON "Message"("viewId");

-- CreateIndex
CREATE INDEX "ConversationView_conversationId_idx" ON "ConversationView"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationView_viewId_idx" ON "ConversationView"("viewId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationView_conversationId_viewId_key" ON "ConversationView"("conversationId", "viewId");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_dataroomId_idx" ON "DataroomFaqItem"("dataroomId");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_linkId_idx" ON "DataroomFaqItem"("linkId");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_dataroomDocumentId_idx" ON "DataroomFaqItem"("dataroomDocumentId");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_sourceConversationId_idx" ON "DataroomFaqItem"("sourceConversationId");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_teamId_idx" ON "DataroomFaqItem"("teamId");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_publishedByUserId_idx" ON "DataroomFaqItem"("publishedByUserId");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_status_idx" ON "DataroomFaqItem"("status");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_visibilityMode_idx" ON "DataroomFaqItem"("visibilityMode");

-- CreateIndex
CREATE INDEX "DataroomFaqItem_createdAt_idx" ON "DataroomFaqItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dataroom_pId_key" ON "Dataroom"("pId");

-- CreateIndex
CREATE INDEX "Dataroom_teamId_idx" ON "Dataroom"("teamId");

-- CreateIndex
CREATE INDEX "Dataroom_brandId_idx" ON "Dataroom"("brandId");

-- CreateIndex
CREATE INDEX "TaskList_dataroomId_idx" ON "TaskList"("dataroomId");

-- CreateIndex
CREATE INDEX "TaskList_teamId_idx" ON "TaskList"("teamId");

-- CreateIndex
CREATE INDEX "TaskList_dataroomId_orderIndex_idx" ON "TaskList"("dataroomId", "orderIndex");

-- CreateIndex
CREATE INDEX "Task_taskListId_idx" ON "Task"("taskListId");

-- CreateIndex
CREATE INDEX "Task_dataroomId_idx" ON "Task"("dataroomId");

-- CreateIndex
CREATE INDEX "Task_teamId_idx" ON "Task"("teamId");

-- CreateIndex
CREATE INDEX "Task_uploadFolderId_idx" ON "Task"("uploadFolderId");

-- CreateIndex
CREATE INDEX "Task_taskListId_orderIndex_idx" ON "Task"("taskListId", "orderIndex");

-- CreateIndex
CREATE INDEX "TaskAssignment_taskId_idx" ON "TaskAssignment"("taskId");

-- CreateIndex
CREATE INDEX "TaskAssignment_viewerId_idx" ON "TaskAssignment"("viewerId");

-- CreateIndex
CREATE INDEX "TaskAssignment_groupId_idx" ON "TaskAssignment"("groupId");

-- CreateIndex
CREATE INDEX "TaskAssignment_linkId_idx" ON "TaskAssignment"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_viewerId_key" ON "TaskAssignment"("taskId", "viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_groupId_key" ON "TaskAssignment"("taskId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_linkId_key" ON "TaskAssignment"("taskId", "linkId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_email_key" ON "TaskAssignment"("taskId", "email");

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_idx" ON "TaskActivity"("taskId");

-- CreateIndex
CREATE INDEX "TaskActivity_userId_idx" ON "TaskActivity"("userId");

-- CreateIndex
CREATE INDEX "TaskActivity_viewerId_idx" ON "TaskActivity"("viewerId");

-- CreateIndex
CREATE INDEX "TaskActivity_viewId_idx" ON "TaskActivity"("viewId");

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_createdAt_idx" ON "TaskActivity"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "DataroomDocument_folderId_idx" ON "DataroomDocument"("folderId");

-- CreateIndex
CREATE INDEX "DataroomDocument_dataroomId_folderId_orderIndex_idx" ON "DataroomDocument"("dataroomId", "folderId", "orderIndex");

-- CreateIndex
CREATE INDEX "DataroomDocument_documentId_idx" ON "DataroomDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DataroomDocument_dataroomId_documentId_key" ON "DataroomDocument"("dataroomId", "documentId");

-- CreateIndex
CREATE INDEX "DataroomFolder_parentId_idx" ON "DataroomFolder"("parentId");

-- CreateIndex
CREATE INDEX "DataroomFolder_dataroomId_parentId_orderIndex_idx" ON "DataroomFolder"("dataroomId", "parentId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DataroomFolder_dataroomId_path_key" ON "DataroomFolder"("dataroomId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "DataroomBrand_dataroomId_key" ON "DataroomBrand"("dataroomId");

-- CreateIndex
CREATE INDEX "ViewerGroup_dataroomId_idx" ON "ViewerGroup"("dataroomId");

-- CreateIndex
CREATE INDEX "ViewerGroup_teamId_idx" ON "ViewerGroup"("teamId");

-- CreateIndex
CREATE INDEX "ViewerGroup_dataroomId_createdAt_idx" ON "ViewerGroup"("dataroomId", "createdAt");

-- CreateIndex
CREATE INDEX "ViewerGroupMembership_viewerId_idx" ON "ViewerGroupMembership"("viewerId");

-- CreateIndex
CREATE INDEX "ViewerGroupMembership_groupId_idx" ON "ViewerGroupMembership"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerGroupMembership_viewerId_groupId_key" ON "ViewerGroupMembership"("viewerId", "groupId");

-- CreateIndex
CREATE INDEX "ViewerGroupAccessControls_groupId_idx" ON "ViewerGroupAccessControls"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerGroupAccessControls_groupId_itemId_key" ON "ViewerGroupAccessControls"("groupId", "itemId");

-- CreateIndex
CREATE INDEX "PermissionGroup_dataroomId_idx" ON "PermissionGroup"("dataroomId");

-- CreateIndex
CREATE INDEX "PermissionGroup_teamId_idx" ON "PermissionGroup"("teamId");

-- CreateIndex
CREATE INDEX "PermissionGroupAccessControls_groupId_idx" ON "PermissionGroupAccessControls"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroupAccessControls_groupId_itemId_key" ON "PermissionGroupAccessControls"("groupId", "itemId");

-- CreateIndex
CREATE INDEX "Document_ownerId_idx" ON "Document"("ownerId");

-- CreateIndex
CREATE INDEX "Document_teamId_idx" ON "Document"("teamId");

-- CreateIndex
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");

-- CreateIndex
CREATE INDEX "Document_teamId_folderId_idx" ON "Document"("teamId", "folderId");

-- CreateIndex
CREATE INDEX "Document_teamId_name_idx" ON "Document"("teamId", "name");

-- CreateIndex
CREATE INDEX "Document_teamId_hiddenInAllDocuments_idx" ON "Document"("teamId", "hiddenInAllDocuments");

-- CreateIndex
CREATE UNIQUE INDEX "Document_id_teamId_key" ON "Document"("id", "teamId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_isPrimary_idx" ON "DocumentVersion"("documentId", "isPrimary");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_isPrimary_createdAt_idx" ON "DocumentVersion"("documentId", "isPrimary", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_id_documentId_key" ON "DocumentVersion"("id", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_versionNumber_documentId_key" ON "DocumentVersion"("versionNumber", "documentId");

-- CreateIndex
CREATE INDEX "DocumentPage_versionId_idx" ON "DocumentPage"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPage_pageNumber_versionId_key" ON "DocumentPage"("pageNumber", "versionId");

-- CreateIndex
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

-- CreateIndex
CREATE INDEX "Folder_teamId_hiddenInAllDocuments_idx" ON "Folder"("teamId", "hiddenInAllDocuments");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_teamId_path_key" ON "Folder"("teamId", "path");

-- CreateIndex
CREATE INDEX "DocumentUpload_documentId_idx" ON "DocumentUpload"("documentId");

-- CreateIndex
CREATE INDEX "DocumentUpload_viewerId_idx" ON "DocumentUpload"("viewerId");

-- CreateIndex
CREATE INDEX "DocumentUpload_viewId_idx" ON "DocumentUpload"("viewId");

-- CreateIndex
CREATE INDEX "DocumentUpload_linkId_idx" ON "DocumentUpload"("linkId");

-- CreateIndex
CREATE INDEX "DocumentUpload_teamId_idx" ON "DocumentUpload"("teamId");

-- CreateIndex
CREATE INDEX "DocumentUpload_dataroomId_idx" ON "DocumentUpload"("dataroomId");

-- CreateIndex
CREATE INDEX "DocumentUpload_dataroomDocumentId_idx" ON "DocumentUpload"("dataroomDocumentId");

-- CreateIndex
CREATE INDEX "DocumentUpload_taskId_idx" ON "DocumentUpload"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingDocumentUpload_uploadId_key" ON "PendingDocumentUpload"("uploadId");

-- CreateIndex
CREATE INDEX "PendingDocumentUpload_teamId_expiresAt_idx" ON "PendingDocumentUpload"("teamId", "expiresAt");

-- CreateIndex
CREATE INDEX "PendingDocumentUpload_tokenId_expiresAt_idx" ON "PendingDocumentUpload"("tokenId", "expiresAt");

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
CREATE UNIQUE INDEX "Integration_slug_key" ON "Integration"("slug");

-- CreateIndex
CREATE INDEX "InstalledIntegration_teamId_idx" ON "InstalledIntegration"("teamId");

-- CreateIndex
CREATE INDEX "InstalledIntegration_integrationId_idx" ON "InstalledIntegration"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "InstalledIntegration_teamId_integrationId_key" ON "InstalledIntegration"("teamId", "integrationId");

-- CreateIndex
CREATE INDEX "_jackson_index_key_store" ON "jackson_index"("key", "storeKey");

-- CreateIndex
CREATE INDEX "_jackson_store_namespace" ON "jackson_store"("namespace");

-- CreateIndex
CREATE INDEX "_jackson_ttl_expires_at" ON "jackson_ttl"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Link_url_key" ON "Link"("url");

-- CreateIndex
CREATE INDEX "Link_documentId_idx" ON "Link"("documentId");

-- CreateIndex
CREATE INDEX "Link_teamId_idx" ON "Link"("teamId");

-- CreateIndex
CREATE INDEX "Link_documentId_isArchived_idx" ON "Link"("documentId", "isArchived");

-- CreateIndex
CREATE INDEX "Link_permissionGroupId_idx" ON "Link"("permissionGroupId");

-- CreateIndex
CREATE INDEX "Link_deletedAt_idx" ON "Link"("deletedAt");

-- CreateIndex
CREATE INDEX "Link_ownerId_idx" ON "Link"("ownerId");

-- CreateIndex
CREATE INDEX "Link_brandId_idx" ON "Link"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Link_domainSlug_slug_key" ON "Link"("domainSlug", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "LinkPreset_pId_key" ON "LinkPreset"("pId");

-- CreateIndex
CREATE INDEX "LinkPreset_teamId_idx" ON "LinkPreset"("teamId");

-- CreateIndex
CREATE INDEX "VisitorGroup_teamId_idx" ON "VisitorGroup"("teamId");

-- CreateIndex
CREATE INDEX "LinkVisitorGroup_linkId_idx" ON "LinkVisitorGroup"("linkId");

-- CreateIndex
CREATE INDEX "LinkVisitorGroup_visitorGroupId_idx" ON "LinkVisitorGroup"("visitorGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkVisitorGroup_linkId_visitorGroupId_key" ON "LinkVisitorGroup"("linkId", "visitorGroupId");

-- CreateIndex
CREATE INDEX "CustomField_linkId_idx" ON "CustomField"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldResponse_viewId_key" ON "CustomFieldResponse"("viewId");

-- CreateIndex
CREATE INDEX "CustomFieldResponse_viewId_idx" ON "CustomFieldResponse"("viewId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_teamId_idx" ON "NotificationPreference"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_teamId_type_key" ON "NotificationPreference"("userId", "teamId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthClient_clientId_idx" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthClientApproval_clientId_idx" ON "OAuthClientApproval"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClientApproval_userId_clientId_key" ON "OAuthClientApproval"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthGrantTeam_grantId_key" ON "OAuthGrantTeam"("grantId");

-- CreateIndex
CREATE INDEX "OAuthGrantTeam_grantId_idx" ON "OAuthGrantTeam"("grantId");

-- CreateIndex
CREATE INDEX "OAuthRecord_kind_idx" ON "OAuthRecord"("kind");

-- CreateIndex
CREATE INDEX "OAuthRecord_grantId_idx" ON "OAuthRecord"("grantId");

-- CreateIndex
CREATE INDEX "OAuthRecord_userCode_idx" ON "OAuthRecord"("userCode");

-- CreateIndex
CREATE INDEX "OAuthRecord_uid_idx" ON "OAuthRecord"("uid");

-- CreateIndex
CREATE INDEX "OAuthRecord_expiresAt_idx" ON "OAuthRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "DocumentRedactionJob_documentId_idx" ON "DocumentRedactionJob"("documentId");

-- CreateIndex
CREATE INDEX "DocumentRedactionJob_documentVersionId_idx" ON "DocumentRedactionJob"("documentVersionId");

-- CreateIndex
CREATE INDEX "DocumentRedactionJob_teamId_idx" ON "DocumentRedactionJob"("teamId");

-- CreateIndex
CREATE INDEX "DocumentRedactionJob_teamId_status_idx" ON "DocumentRedactionJob"("teamId", "status");

-- CreateIndex
CREATE INDEX "DocumentRedaction_jobId_idx" ON "DocumentRedaction"("jobId");

-- CreateIndex
CREATE INDEX "DocumentRedaction_jobId_pageNumber_idx" ON "DocumentRedaction"("jobId", "pageNumber");

-- CreateIndex
CREATE INDEX "DocumentRedaction_jobId_status_idx" ON "DocumentRedaction"("jobId", "status");

-- CreateIndex
CREATE INDEX "ReferralInvite_userId_idx" ON "ReferralInvite"("userId");

-- CreateIndex
CREATE INDEX "ReferralInvite_teamId_idx" ON "ReferralInvite"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralInvite_scopeId_email_key" ON "ReferralInvite"("scopeId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeId_key" ON "User"("stripeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_subscriptionId_key" ON "User"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_slug_key" ON "Domain"("slug");

-- CreateIndex
CREATE INDEX "Domain_userId_idx" ON "Domain"("userId");

-- CreateIndex
CREATE INDEX "Domain_teamId_idx" ON "Domain"("teamId");

-- CreateIndex
CREATE INDEX "View_linkId_idx" ON "View"("linkId");

-- CreateIndex
CREATE INDEX "View_documentId_idx" ON "View"("documentId");

-- CreateIndex
CREATE INDEX "View_dataroomId_idx" ON "View"("dataroomId");

-- CreateIndex
CREATE INDEX "View_dataroomViewId_idx" ON "View"("dataroomViewId");

-- CreateIndex
CREATE INDEX "View_viewerId_idx" ON "View"("viewerId");

-- CreateIndex
CREATE INDEX "View_groupId_idx" ON "View"("groupId");

-- CreateIndex
CREATE INDEX "View_teamId_idx" ON "View"("teamId");

-- CreateIndex
CREATE INDEX "View_viewedAt_idx" ON "View"("viewedAt" DESC);

-- CreateIndex
CREATE INDEX "View_viewerId_documentId_idx" ON "View"("viewerId", "documentId");

-- CreateIndex
CREATE INDEX "View_viewerEmail_idx" ON "View"("viewerEmail");

-- CreateIndex
CREATE INDEX "View_documentId_isArchived_idx" ON "View"("documentId", "isArchived");

-- CreateIndex
CREATE INDEX "View_documentId_viewedAt_idx" ON "View"("documentId", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "Viewer_teamId_idx" ON "Viewer"("teamId");

-- CreateIndex
CREATE INDEX "Viewer_dataroomId_idx" ON "Viewer"("dataroomId");

-- CreateIndex
CREATE UNIQUE INDEX "Viewer_teamId_email_key" ON "Viewer"("teamId", "email");

-- CreateIndex
CREATE INDEX "Reaction_viewId_idx" ON "Reaction"("viewId");

-- CreateIndex
CREATE INDEX "Reaction_viewId_type_idx" ON "Reaction"("viewId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_email_teamId_key" ON "Invitation"("email", "teamId");

-- CreateIndex
CREATE INDEX "SentEmail_teamId_idx" ON "SentEmail"("teamId");

-- CreateIndex
CREATE INDEX "Chat_teamId_idx" ON "Chat"("teamId");

-- CreateIndex
CREATE INDEX "Chat_documentId_idx" ON "Chat"("documentId");

-- CreateIndex
CREATE INDEX "Chat_dataroomId_idx" ON "Chat"("dataroomId");

-- CreateIndex
CREATE INDEX "Chat_linkId_idx" ON "Chat"("linkId");

-- CreateIndex
CREATE INDEX "Chat_userId_idx" ON "Chat"("userId");

-- CreateIndex
CREATE INDEX "Chat_viewerId_idx" ON "Chat"("viewerId");

-- CreateIndex
CREATE INDEX "Chat_viewId_idx" ON "Chat"("viewId");

-- CreateIndex
CREATE INDEX "Chat_createdAt_idx" ON "Chat"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ChatMessage_chatId_idx" ON "ChatMessage"("chatId");

-- CreateIndex
CREATE INDEX "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_linkId_key" ON "Feedback"("linkId");

-- CreateIndex
CREATE INDEX "Feedback_linkId_idx" ON "Feedback"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackResponse_viewId_key" ON "FeedbackResponse"("viewId");

-- CreateIndex
CREATE INDEX "FeedbackResponse_feedbackId_idx" ON "FeedbackResponse"("feedbackId");

-- CreateIndex
CREATE INDEX "FeedbackResponse_viewId_idx" ON "FeedbackResponse"("viewId");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_signingExternalId_key" ON "Agreement"("signingExternalId");

-- CreateIndex
CREATE INDEX "Agreement_teamId_idx" ON "Agreement"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementResponse_viewId_key" ON "AgreementResponse"("viewId");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementResponse_signingExternalId_key" ON "AgreementResponse"("signingExternalId");

-- CreateIndex
CREATE INDEX "AgreementResponse_agreementId_idx" ON "AgreementResponse"("agreementId");

-- CreateIndex
CREATE INDEX "AgreementResponse_viewId_idx" ON "AgreementResponse"("viewId");

-- CreateIndex
CREATE INDEX "AgreementResponse_linkId_idx" ON "AgreementResponse"("linkId");

-- CreateIndex
CREATE INDEX "AgreementResponse_signerEmail_idx" ON "AgreementResponse"("signerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "IncomingWebhook_externalId_key" ON "IncomingWebhook"("externalId");

-- CreateIndex
CREATE INDEX "IncomingWebhook_teamId_idx" ON "IncomingWebhook"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "RestrictedToken_hashedKey_key" ON "RestrictedToken"("hashedKey");

-- CreateIndex
CREATE INDEX "RestrictedToken_userId_idx" ON "RestrictedToken"("userId");

-- CreateIndex
CREATE INDEX "RestrictedToken_teamId_idx" ON "RestrictedToken"("teamId");

-- CreateIndex
CREATE INDEX "RestrictedToken_hashedKey_idx" ON "RestrictedToken"("hashedKey");

-- CreateIndex
CREATE INDEX "RestrictedToken_clientId_idx" ON "RestrictedToken"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_pId_key" ON "Webhook"("pId");

-- CreateIndex
CREATE INDEX "Webhook_teamId_idx" ON "Webhook"("teamId");

-- CreateIndex
CREATE INDEX "YearInReview_status_attempts_idx" ON "YearInReview"("status", "attempts");

-- CreateIndex
CREATE INDEX "YearInReview_teamId_idx" ON "YearInReview"("teamId");

-- CreateIndex
CREATE INDEX "Tag_teamId_idx" ON "Tag"("teamId");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Tag_id_idx" ON "Tag"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_teamId_name_key" ON "Tag"("teamId", "name");

-- CreateIndex
CREATE INDEX "TagItem_tagId_linkId_idx" ON "TagItem"("tagId", "linkId");

-- CreateIndex
CREATE INDEX "TagItem_tagId_documentId_idx" ON "TagItem"("tagId", "documentId");

-- CreateIndex
CREATE INDEX "TagItem_tagId_dataroomId_idx" ON "TagItem"("tagId", "dataroomId");

-- CreateIndex
CREATE INDEX "ViewerInvitation_viewerId_idx" ON "ViewerInvitation"("viewerId");

-- CreateIndex
CREATE INDEX "ViewerInvitation_linkId_idx" ON "ViewerInvitation"("linkId");

-- CreateIndex
CREATE INDEX "ViewerInvitation_groupId_idx" ON "ViewerInvitation"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_stripeId_key" ON "Team"("stripeId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_subscriptionId_key" ON "Team"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_ssoEmailDomain_key" ON "Team"("ssoEmailDomain");

-- CreateIndex
CREATE INDEX "Team_defaultBrandId_idx" ON "Team"("defaultBrandId");

-- CreateIndex
CREATE INDEX "UserDataroom_userId_idx" ON "UserDataroom"("userId");

-- CreateIndex
CREATE INDEX "UserDataroom_teamId_idx" ON "UserDataroom"("teamId");

-- CreateIndex
CREATE INDEX "UserDataroom_dataroomId_idx" ON "UserDataroom"("dataroomId");

-- CreateIndex
CREATE INDEX "UserTeam_userId_idx" ON "UserTeam"("userId");

-- CreateIndex
CREATE INDEX "UserTeam_teamId_idx" ON "UserTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_entryLinkId_key" ON "Workflow"("entryLinkId");

-- CreateIndex
CREATE INDEX "Workflow_entryLinkId_idx" ON "Workflow"("entryLinkId");

-- CreateIndex
CREATE INDEX "Workflow_teamId_idx" ON "Workflow"("teamId");

-- CreateIndex
CREATE INDEX "Workflow_isActive_idx" ON "Workflow"("isActive");

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowId_idx" ON "WorkflowStep"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_workflowId_stepOrder_key" ON "WorkflowStep"("workflowId", "stepOrder");

-- CreateIndex
CREATE INDEX "WorkflowExecution_workflowId_startedAt_idx" ON "WorkflowExecution"("workflowId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowExecution_visitorEmail_idx" ON "WorkflowExecution"("visitorEmail");

-- CreateIndex
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");

-- CreateIndex
CREATE INDEX "WorkflowStepLog_executionId_idx" ON "WorkflowStepLog"("executionId");

-- CreateIndex
CREATE INDEX "WorkflowStepLog_workflowStepId_idx" ON "WorkflowStepLog"("workflowStepId");

-- AddForeignKey
ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationImage" ADD CONSTRAINT "AnnotationImage_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "DocumentAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dataroomDocumentId_fkey" FOREIGN KEY ("dataroomDocumentId") REFERENCES "DataroomDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_viewerGroupId_fkey" FOREIGN KEY ("viewerGroupId") REFERENCES "ViewerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "DataroomQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_recipientViewerId_fkey" FOREIGN KEY ("recipientViewerId") REFERENCES "Viewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_initialViewId_fkey" FOREIGN KEY ("initialViewId") REFERENCES "View"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomQuestion" ADD CONSTRAINT "DataroomQuestion_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomQuestion" ADD CONSTRAINT "DataroomQuestion_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomQuestion" ADD CONSTRAINT "DataroomQuestion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomQuestion" ADD CONSTRAINT "DataroomQuestion_dataroomDocumentId_fkey" FOREIGN KEY ("dataroomDocumentId") REFERENCES "DataroomDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomQuestionAssignment" ADD CONSTRAINT "DataroomQuestionAssignment_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "DataroomQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomQuestionAssignment" ADD CONSTRAINT "DataroomQuestionAssignment_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomQuestionAssignment" ADD CONSTRAINT "DataroomQuestionAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ViewerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomQuestionAssignment" ADD CONSTRAINT "DataroomQuestionAssignment_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationView" ADD CONSTRAINT "ConversationView_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationView" ADD CONSTRAINT "ConversationView_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFaqItem" ADD CONSTRAINT "DataroomFaqItem_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFaqItem" ADD CONSTRAINT "DataroomFaqItem_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFaqItem" ADD CONSTRAINT "DataroomFaqItem_dataroomDocumentId_fkey" FOREIGN KEY ("dataroomDocumentId") REFERENCES "DataroomDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFaqItem" ADD CONSTRAINT "DataroomFaqItem_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFaqItem" ADD CONSTRAINT "DataroomFaqItem_questionMessageId_fkey" FOREIGN KEY ("questionMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFaqItem" ADD CONSTRAINT "DataroomFaqItem_answerMessageId_fkey" FOREIGN KEY ("answerMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFaqItem" ADD CONSTRAINT "DataroomFaqItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFaqItem" ADD CONSTRAINT "DataroomFaqItem_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataroom" ADD CONSTRAINT "Dataroom_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataroom" ADD CONSTRAINT "Dataroom_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataroom" ADD CONSTRAINT "Dataroom_frozenBy_fkey" FOREIGN KEY ("frozenBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskList" ADD CONSTRAINT "TaskList_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskListId_fkey" FOREIGN KEY ("taskListId") REFERENCES "TaskList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_uploadFolderId_fkey" FOREIGN KEY ("uploadFolderId") REFERENCES "DataroomFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ViewerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomDocument" ADD CONSTRAINT "DataroomDocument_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomDocument" ADD CONSTRAINT "DataroomDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomDocument" ADD CONSTRAINT "DataroomDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DataroomFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFolder" ADD CONSTRAINT "DataroomFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DataroomFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomFolder" ADD CONSTRAINT "DataroomFolder_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataroomBrand" ADD CONSTRAINT "DataroomBrand_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroup" ADD CONSTRAINT "ViewerGroup_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroup" ADD CONSTRAINT "ViewerGroup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroupMembership" ADD CONSTRAINT "ViewerGroupMembership_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroupMembership" ADD CONSTRAINT "ViewerGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ViewerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerGroupAccessControls" ADD CONSTRAINT "ViewerGroupAccessControls_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ViewerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroup" ADD CONSTRAINT "PermissionGroup_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroup" ADD CONSTRAINT "PermissionGroup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGroupAccessControls" ADD CONSTRAINT "PermissionGroupAccessControls_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_dataroomDocumentId_fkey" FOREIGN KEY ("dataroomDocumentId") REFERENCES "DataroomDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "InstalledIntegration" ADD CONSTRAINT "InstalledIntegration_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledIntegration" ADD CONSTRAINT "InstalledIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledIntegration" ADD CONSTRAINT "InstalledIntegration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ViewerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_permissionGroupId_fkey" FOREIGN KEY ("permissionGroupId") REFERENCES "PermissionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkPreset" ADD CONSTRAINT "LinkPreset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorGroup" ADD CONSTRAINT "VisitorGroup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkVisitorGroup" ADD CONSTRAINT "LinkVisitorGroup_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkVisitorGroup" ADD CONSTRAINT "LinkVisitorGroup_visitorGroupId_fkey" FOREIGN KEY ("visitorGroupId") REFERENCES "VisitorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldResponse" ADD CONSTRAINT "CustomFieldResponse_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRedactionJob" ADD CONSTRAINT "DocumentRedactionJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRedactionJob" ADD CONSTRAINT "DocumentRedactionJob_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRedactionJob" ADD CONSTRAINT "DocumentRedactionJob_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRedactionJob" ADD CONSTRAINT "DocumentRedactionJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRedaction" ADD CONSTRAINT "DocumentRedaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DocumentRedactionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralInvite" ADD CONSTRAINT "ReferralInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralInvite" ADD CONSTRAINT "ReferralInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ViewerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viewer" ADD CONSTRAINT "Viewer_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viewer" ADD CONSTRAINT "Viewer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentEmail" ADD CONSTRAINT "SentEmail_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementResponse" ADD CONSTRAINT "AgreementResponse_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementResponse" ADD CONSTRAINT "AgreementResponse_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingWebhook" ADD CONSTRAINT "IncomingWebhook_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestrictedToken" ADD CONSTRAINT "RestrictedToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestrictedToken" ADD CONSTRAINT "RestrictedToken_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestrictedToken" ADD CONSTRAINT "RestrictedToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagItem" ADD CONSTRAINT "TagItem_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagItem" ADD CONSTRAINT "TagItem_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagItem" ADD CONSTRAINT "TagItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagItem" ADD CONSTRAINT "TagItem_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerInvitation" ADD CONSTRAINT "ViewerInvitation_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Viewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerInvitation" ADD CONSTRAINT "ViewerInvitation_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerInvitation" ADD CONSTRAINT "ViewerInvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ViewerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_defaultBrandId_fkey" FOREIGN KEY ("defaultBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDataroom" ADD CONSTRAINT "UserDataroom_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDataroom" ADD CONSTRAINT "UserDataroom_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDataroom" ADD CONSTRAINT "UserDataroom_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_entryLinkId_fkey" FOREIGN KEY ("entryLinkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepLog" ADD CONSTRAINT "WorkflowStepLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepLog" ADD CONSTRAINT "WorkflowStepLog_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Invariants not expressible in the Prisma schema.
ALTER TABLE "HuRoomStage" ADD CONSTRAINT "HuRoomStage_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "HuRoomMembership" ADD CONSTRAINT "HuRoomMembership_email_normalized" CHECK ("email" = lower(btrim("email")) AND length("email") > 3);
ALTER TABLE "HuRoomMembership" ADD CONSTRAINT "HuRoomMembership_acceptance_user" CHECK ("acceptedAt" IS NULL OR "userId" IS NOT NULL);
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_resolution_pair" CHECK (("resolvedAt" IS NULL) = ("resolvedById" IS NULL));
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_document_context" CHECK (("documentId" IS NULL AND "documentVersionId" IS NULL AND "pageNumber" IS NULL) OR ("documentId" IS NOT NULL AND "documentVersionId" IS NOT NULL AND ("pageNumber" IS NULL OR "pageNumber" > 0)));
ALTER TABLE "HuRoomDiscussion" ADD CONSTRAINT "HuRoomDiscussion_title_length" CHECK (length(btrim("title")) BETWEEN 1 AND 300);
ALTER TABLE "HuRoomMessage" ADD CONSTRAINT "HuRoomMessage_body_length" CHECK (length(btrim("body")) BETWEEN 1 AND 20000);

ALTER TABLE "HuPageReading" ADD CONSTRAINT "HuPageReading_bounds" CHECK ("pageNumber" > 0 AND "visibleMs" >= 0);
