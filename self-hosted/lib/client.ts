export async function request<T = Record<string, unknown>>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
  return result;
}
export const action = <T = Record<string, unknown>>(name: string, values: Record<string, unknown> = {}) => request<T>('/api/action', { action: name, ...values });
export type Stage = { id: string; name: string; position: number; _count?: { rooms: number; documentRules: number } };
export type DocumentVersionInfo = { id: string; versionNumber: number; numPages: number | null; fileSize?: string | null; createdAt?: string; type: string; hasThumbnail: boolean };
export type LibraryDocument = { id: string; name: string; type?: string | null; folderId: string | null; huAccessRule: { minimumStageId: string } | null; versions: DocumentVersionInfo[]; _count?: { huRoomSelections: number };
  huRoomSelections?: { room: { id: string; name: string; stageId: string; archivedAt: string | null } }[] };
export type Folder = { id: string; name: string; parentId: string | null };
export type Room = { id: string; name: string; stageId: string; archivedAt: string | null };
export type Workspace = { actor: { id: string; email: string; admin: boolean }; stages: Stage[]; rooms: Room[]; library: LibraryDocument[]; folders: Folder[] };

/** URL of a published file for the in-page viewer (not recorded as a download). */
export function fileUrl(documentId: string, versionId: string, roomId?: string, thumb = false) {
  const params = new URLSearchParams({ documentId, versionId, ...(roomId ? { roomId } : {}), ...(thumb ? { thumb: '1' } : {}) });
  return `/api/file?${params}`;
}
export function downloadUrl(roomId: string, documentId?: string) {
  return `/api/download?${new URLSearchParams(documentId ? { roomId, documentId } : { roomId, all: '1' })}`;
}
