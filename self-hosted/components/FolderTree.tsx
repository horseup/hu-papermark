import { type ReactNode, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, Home } from 'lucide-react';
import type { Folder as FolderType } from '../lib/client';

export function ancestorsOf(folders: FolderType[], id: string | null): FolderType[] {
  const byId = new Map(folders.map(f => [f.id, f]));
  const path: FolderType[] = [];
  for (let cursor = id ? byId.get(id) : undefined; cursor && path.length < 64; cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined) path.unshift(cursor);
  return path;
}

type TreeFile = { id: string; name: string; folderId: string | null };

/** Folder navigation. In rooms, an open folder also lists its files. */
export function FolderTree({ folders, current, onSelect, files, onOpenFile, counts, homeLabel = 'Home', label }: {
  folders: FolderType[]; current: string | null; onSelect: (id: string | null) => void;
  files?: TreeFile[]; onOpenFile?: (id: string) => void; counts?: Map<string | null, number>; homeLabel?: string; label: string;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(ancestorsOf(folders, current).map(f => f.id)));
  // Opening a folder from the table or breadcrumb also opens it in the tree.
  useEffect(() => { setOpen(previous => { const next = new Set(previous); for (const f of ancestorsOf(folders, current)) next.add(f.id); return next; }); }, [current, folders]);
  const pick = (id: string) => {
    setOpen(previous => { const next = new Set(previous); if (current === id && next.has(id)) next.delete(id); else next.add(id); return next; });
    onSelect(id);
  };
  const children = (parent: string | null) => folders.filter(f => f.parentId === parent).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const branch = (parent: string | null, depth: number): ReactNode => children(parent).map(f => {
    const expanded = open.has(f.id);
    const count = counts?.get(f.id);
    return <li key={f.id}>
      <button type="button" className={`tree-item${current === f.id ? ' is-selected' : ''}`} style={{ paddingLeft: 8 + depth * 18 }} onClick={() => pick(f.id)} aria-expanded={expanded} aria-current={current === f.id ? 'true' : undefined}>
        <span className="tree-chevron">{expanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}</span>
        <Folder size={16} strokeWidth={1.6} aria-hidden="true" /><span className="tree-label">{f.name}</span>{count ? <span className="tree-count">{count}</span> : null}
      </button>
      {expanded && <ul>{branch(f.id, depth + 1)}
        {files?.filter(file => file.folderId === f.id).map(file => <li key={file.id}><button type="button" className="tree-item" style={{ paddingLeft: 8 + (depth + 1) * 18 + 18 }} onClick={() => onOpenFile?.(file.id)}>
          <FileText size={16} strokeWidth={1.6} aria-hidden="true" /><span className="tree-label">{file.name}</span></button></li>)}
      </ul>}
    </li>;
  });
  return <nav className="tree" aria-label={label}><ul>
    <li><button type="button" className={`tree-item${current === null ? ' is-selected' : ''}`} style={{ paddingLeft: 8 }} onClick={() => onSelect(null)} aria-current={current === null ? 'true' : undefined}>
      <Home size={16} strokeWidth={1.6} aria-hidden="true" /><span className="tree-label">{homeLabel}</span>{counts?.get(null) ? <span className="tree-count">{counts.get(null)}</span> : null}
    </button></li>
    {branch(null, 0)}
  </ul></nav>;
}
