import { teamId } from './config';
import type { Database } from './access';
import { db } from './db';

export type FolderNode = { id: string; name: string; parentId: string | null };

export async function loadFolders(client: Database | typeof db = db): Promise<FolderNode[]> {
  return client.huFolder.findMany({ where: { teamId }, select: { id: true, name: true, parentId: true }, orderBy: { name: 'asc' } });
}

/** documentId → folderId for the given documents (documents at the top level are absent). */
export async function placementsFor(documentIds: string[], client: Database | typeof db = db) {
  if (!documentIds.length) return new Map<string, string>();
  const rows = await client.huDocumentFolder.findMany({ where: { teamId, documentId: { in: documentIds } }, select: { documentId: true, folderId: true } });
  return new Map(rows.map(r => [r.documentId, r.folderId]));
}

/** The folders that lead to at least one of the given folders: those folders plus all their ancestors. */
export function foldersLeadingTo(folders: FolderNode[], used: Iterable<string>): FolderNode[] {
  const byId = new Map(folders.map(f => [f.id, f]));
  const keep = new Set<string>();
  for (const start of used) {
    let cursor: string | null = start;
    for (let depth = 0; cursor && !keep.has(cursor) && depth < 64; depth++) {
      keep.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
  }
  return folders.filter(f => keep.has(f.id));
}

/** A folder's path, e.g. "Financials/Monthly Actuals", with names safe for ZIP entries. */
export function folderPath(folders: FolderNode[], folderId: string | null | undefined): string {
  const byId = new Map(folders.map(f => [f.id, f]));
  const parts: string[] = [];
  let cursor = folderId ?? null;
  for (let depth = 0; cursor && depth < 64; depth++) {
    const folder = byId.get(cursor);
    if (!folder) break;
    // eslint-disable-next-line no-control-regex
    parts.unshift(folder.name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '-').replace(/^\.+/, '').trim() || 'Folder');
    cursor = folder.parentId;
  }
  return parts.join('/');
}
