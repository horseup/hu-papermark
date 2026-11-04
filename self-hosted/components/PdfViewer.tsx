import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { action } from '../lib/client';
import type { Anchor, AnchorRect } from '../lib/room-types';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

import { anchorPoint, type Point } from '../lib/anchor';
export type PageHighlight = { id: string; number: number; rects: AnchorRect[]; active: boolean };

const clamp = (value: number) => Math.min(1, Math.max(0, value));
// Merge the many small client rects a text selection produces into one box per line.
function lineRects(rects: DOMRect[], box: DOMRect): AnchorRect[] {
  const lines: { top: number; bottom: number; left: number; right: number }[] = [];
  for (const r of rects) {
    if (r.width < 1 || r.height < 1) continue;
    const line = lines.find(l => Math.abs(l.top - r.top) < r.height / 2);
    if (line) { line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right); line.bottom = Math.max(line.bottom, r.bottom); }
    else lines.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  }
  return lines.slice(0, 60).map(l => {
    const x = clamp((l.left - box.left) / box.width); const y = clamp((l.top - box.top) / box.height);
    return { x, y, w: Math.max(0.001, clamp((l.right - box.left) / box.width) - x), h: Math.max(0.001, clamp((l.bottom - box.top) / box.height) - y) };
  });
}

export default function PdfViewer({ documentId, versionId, roomId, visitId, page, onPage, highlights = [], onAnchor, onHighlight, overlay, onPageClick }: {
  documentId: string; versionId: string; roomId: string; visitId?: string; page: number; onPage: (page: number) => void;
  highlights?: PageHighlight[]; onAnchor?: (anchor: Anchor, at: Point) => void; onHighlight?: (id: string, at: Point) => void;
  overlay?: ReactNode; onPageClick?: () => void;
}) {
  const [pages, setPages] = useState(0); const [width, setWidth] = useState(600);
  const [areaMode, setAreaMode] = useState(false); const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const container = useRef<HTMLDivElement>(null); const pageBox = useRef<HTMLDivElement>(null); const totals = useRef(new Map<string, number>());
  const visible = useRef(false);
  const url = `/api/pdf?${new URLSearchParams({ documentId, versionId, roomId })}`;
  useEffect(() => { if (!container.current) return; const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width))); observer.observe(container.current); return () => observer.disconnect(); }, []);
  useEffect(() => { if (!container.current) return; const observer = new IntersectionObserver(entries => { visible.current = entries[0].isIntersecting; }); observer.observe(container.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    if (!visitId || !pages || page > pages) return;
    const key = `${versionId}:${page}`; let previous = performance.now();
    const tick = () => { const now = performance.now(); if (visible.current && document.visibilityState === 'visible' && document.hasFocus()) totals.current.set(key, (totals.current.get(key) || 0) + Math.min(2000, now - previous)); previous = now; };
    const report = () => action('recordReading', { roomId, visitId, documentId, versionId, page, visibleMs: Math.floor(totals.current.get(key) || 0) }).catch(() => {});
    const timer = setInterval(tick, 1000); const reporting = setInterval(report, 15000);
    return () => { tick(); clearInterval(timer); clearInterval(reporting); void report(); };
  }, [documentId, versionId, roomId, visitId, page, pages]);

  function selectText() {
    if (!onAnchor || areaMode || !pageBox.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const layer = pageBox.current.querySelector('.textLayer');
    if (!layer || !layer.contains(range.commonAncestorContainer)) return;
    const box = pageBox.current.getBoundingClientRect();
    const rects = lineRects(Array.from(range.getClientRects()), box);
    const quote = selection.toString().replace(/\s+/g, ' ').trim().slice(0, 1000);
    if (!rects.length || !quote) return;
    onAnchor({ kind: 'text', rects, quote }, anchorPoint(rects));
  }
  const relative = (event: React.PointerEvent) => { const box = pageBox.current!.getBoundingClientRect(); return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) }; };
  function finishArea() {
    if (!drag || !pageBox.current) return; setDrag(null);
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1), w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
    if (w < 0.02 || h < 0.01) return;
    setAreaMode(false);
    onAnchor?.({ kind: 'area', rects: [{ x, y, w, h }] }, { left: x + w, top: y + h });
  }

  return <div className="pdf-viewer" ref={container}>
    <div className="pdf-toolbar"><button className="quiet" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page}{pages ? ` of ${pages}` : ''}</span>
      <span className="pdf-tools">{onAnchor && <button type="button" className={areaMode ? '' : 'quiet'} aria-pressed={areaMode} onClick={() => setAreaMode(value => !value)} title="Drag a box around a chart or table to comment on it">{areaMode ? 'Drag a box…' : 'Comment on area'}</button>}
        <button className="quiet" disabled={!pages || page >= pages} onClick={() => onPage(page + 1)}>Next</button></span></div>
    {onAnchor && <p className="pdf-hint muted">Select text, or use “Comment on area”, to comment on a passage.</p>}
    <Document file={url} suspense={false} onLoadSuccess={pdf => setPages(pdf.numPages)} loading={<p role="status">Loading PDF…</p>} error={<p role="alert" className="error">Unable to load this PDF. Refresh the room to check your access and try again.</p>}>
      <div className={`pdf-page${areaMode ? ' area-mode' : ''}`} ref={pageBox} onMouseUp={() => setTimeout(selectText, 0)}
        onClick={event => { if ((event.target as HTMLElement).closest('.pdf-highlight, .inline-pop')) return; if (window.getSelection()?.isCollapsed) onPageClick?.(); }}>
        <Page pageNumber={page} width={width} renderTextLayer renderAnnotationLayer={false} />
        <div className="pdf-highlights" aria-hidden={!highlights.length}>
          {highlights.map(h => <div key={h.id}>{h.rects.map((r, i) => <button key={i} type="button" className={`pdf-highlight${h.active ? ' active' : ''}`} aria-label={`Open comment ${h.number}`} tabIndex={i === 0 ? 0 : -1}
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
            onClick={event => { event.stopPropagation(); onHighlight?.(h.id, anchorPoint(h.rects)); }} />)}
            <span className="pdf-pin" style={{ left: `${(h.rects[h.rects.length - 1].x + h.rects[h.rects.length - 1].w) * 100}%`, top: `${h.rects[h.rects.length - 1].y * 100}%` }}>{h.number}</span></div>)}
        </div>
        {areaMode && <div className="pdf-area" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); const p = relative(event); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
          onPointerMove={event => { if (drag) { const p = relative(event); setDrag({ ...drag, x1: p.x, y1: p.y }); } }} onPointerUp={finishArea}>
          {drag && <div className="pdf-drag" style={{ left: `${Math.min(drag.x0, drag.x1) * 100}%`, top: `${Math.min(drag.y0, drag.y1) * 100}%`, width: `${Math.abs(drag.x1 - drag.x0) * 100}%`, height: `${Math.abs(drag.y1 - drag.y0) * 100}%` }} />}
        </div>}
        {overlay}
      </div>
    </Document>
  </div>;
}
