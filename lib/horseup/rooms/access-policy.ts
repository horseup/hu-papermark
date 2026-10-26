// HorseUp implementation. Licensed under AGPL-3.0-only.
// Independently implements the agreed room-stage policy; no enterprise imports.

export type Room = {
  id: string;
  teamId: string;
  stageId: string;
  archived: boolean;
};

export type Stage = { id: string; teamId: string; position: number };
export type RoomMembership = {
  roomId: string;
  userId: string;
  accepted: boolean;
  revoked: boolean;
};
export type LibraryDocument = {
  id: string;
  teamId: string;
  minimumStageId: string | null;
};
export type RoomDocument = { roomId: string; documentId: string };
export type RoomDiscussion = { roomId: string; documentId: string | null };

export type InvestorAccessContext = {
  userId: string | null;
  emailVerified: boolean;
  room: Room;
  membership: RoomMembership | null;
  stages: readonly Stage[];
};

/**
 * Pure policy only: server handlers must construct this snapshot from a verified
 * session and current database rows, never request-supplied roles or membership.
 * Re-evaluate for every read, write, file download and analytics request.
 * Administrator access is deliberately separate from the investor policy.
 */
export function canEnterRoom(context: InvestorAccessContext): boolean {
  const { userId, emailVerified, room, membership } = context;
  return Boolean(
    userId &&
      emailVerified &&
      !room.archived &&
      membership &&
      membership.userId === userId &&
      membership.roomId === room.id &&
      membership.accepted &&
      !membership.revoked,
  );
}

function resolveStage(
  context: InvestorAccessContext,
  stageId: string,
): Stage | undefined {
  const matches = context.stages.filter(
    (stage) => stage.id === stageId && stage.teamId === context.room.teamId,
  );
  if (matches.length !== 1) return undefined;
  const stage = matches[0];
  if (!Number.isSafeInteger(stage.position) || stage.position < 0) {
    return undefined;
  }
  // A stage order must be unambiguous; fail closed on a corrupted snapshot.
  if (
    context.stages.some(
      (other) =>
        other.teamId === stage.teamId &&
        other.id !== stage.id &&
        other.position === stage.position,
    )
  ) return undefined;
  return stage;
}

export function canReadRoomDocument(
  context: InvestorAccessContext,
  document: LibraryDocument,
  selection: RoomDocument | null,
): boolean {
  if (!canEnterRoom(context)) return false;
  if (document.teamId !== context.room.teamId) return false;
  if (
    !selection ||
    selection.roomId !== context.room.id ||
    selection.documentId !== document.id ||
    !document.minimumStageId
  ) return false;

  const roomStage = resolveStage(context, context.room.stageId);
  const documentStage = resolveStage(context, document.minimumStageId);
  return Boolean(
    roomStage && documentStage && roomStage.position >= documentStage.position,
  );
}

/** Room-wide discussions are shared by all members, never other rooms. */
export function canAccessRoomDiscussion(
  context: InvestorAccessContext,
  discussion: RoomDiscussion,
  document: LibraryDocument | null = null,
  selection: RoomDocument | null = null,
): boolean {
  if (!canEnterRoom(context) || discussion.roomId !== context.room.id) return false;
  if (discussion.documentId === null) return true;
  // A document discussion must not expose content from a locked document.
  return Boolean(
    document &&
      document.id === discussion.documentId &&
      canReadRoomDocument(context, document, selection),
  );
}
