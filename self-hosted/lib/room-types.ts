import type { Workspace, Room, LibraryDocument } from './client';
export type Person = { id: string; name?: string | null; email: string | null };
export type Discussion = { id: string; title: string; documentId: string | null; documentVersionId: string | null; pageNumber: number | null; createdById: string; resolvedAt: string | null;
  messages: { id: string; body: string; createdAt: string; author: Person; mentions: { userId: string }[] }[];
  events: { type: string; createdAt: string; actor: Person }[] };
export type RoomData = Workspace & { room: Room & { selectedDocumentIds: string[] }; documents: LibraryDocument[]; discussions: Discussion[];
  members: { id: string; email: string; userId: string | null; acceptedAt: string | null; revokedAt: string | null }[];
  administrators: Person[]; visits: { id: string; startedAt: string; user: Person; readings: { documentId: string; pageNumber: number; visibleMs: number }[] }[] };
