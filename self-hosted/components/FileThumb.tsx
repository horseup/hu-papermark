import { Folder } from 'lucide-react';
import { fileTypeByExt } from '../lib/file-types';

/**
 * Row preview: the stored JPEG for PDFs and images, a drawn shape per file type
 * otherwise (Word and text pages, a spreadsheet grid, a slide).
 */
export function FileThumb({ type, src }: { type: string | null | undefined; src?: string | null }) {
  const kind = fileTypeByExt(type).kind;
  if (src) return <span className="thumb" aria-hidden="true"><img src={src} alt="" loading="lazy" decoding="async" /></span>;
  return <span className="thumb" aria-hidden="true">
    {kind === 'sheet' ? <span className="thumb-sheet">{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < 3 ? 'h' : ''} />)}</span>
      : kind === 'slides' ? <span className="thumb-slide"><i /><i /></span>
      : kind === 'image' ? <span className="thumb-image" />
      : <span className="thumb-page"><i style={{ width: '70%' }} /><i /><i /><i style={{ width: '80%' }} /><i style={{ width: '55%' }} /></span>}
  </span>;
}

export function FolderThumb() {
  return <span className="thumb" aria-hidden="true"><Folder size={20} strokeWidth={1.6} /></span>;
}
