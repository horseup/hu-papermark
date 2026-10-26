export async function request<T = Record<string, unknown>>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
  return result;
}
export const action = <T = Record<string, unknown>>(name: string, values: Record<string, unknown> = {}) => request<T>('/api/action', { action: name, ...values });
export type Stage = { id: string; name: string; position: number };
export type LibraryDocument = { id: string; name: string; huAccessRule: { minimumStageId: string } | null; versions: { id: string; versionNumber: number; numPages: number | null }[] };
export type Room = { id: string; name: string; stageId: string; archivedAt: string | null };
export type Workspace = { actor: { id: string; email: string; admin: boolean }; stages: Stage[]; rooms: Room[]; library: LibraryDocument[] };
