import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { action } from '../lib/client';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
export default function PdfViewer({ documentId, versionId, roomId, visitId, page, onPage }: {
  documentId: string; versionId: string; roomId: string; visitId?: string; page: number; onPage: (page: number) => void;
}) {
  const [pages, setPages] = useState(0); const [width, setWidth] = useState(600);
  const container = useRef<HTMLDivElement>(null); const totals = useRef(new Map<string, number>());
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
  return <div className="pdf-viewer" ref={container}><div className="pdf-toolbar"><button className="quiet" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page}{pages ? ` of ${pages}` : ''}</span><button className="quiet" disabled={!pages || page >= pages} onClick={() => onPage(page + 1)}>Next</button></div>
    <Document file={url} suspense={false} onLoadSuccess={pdf => setPages(pdf.numPages)} loading={<p role="status">Loading PDF…</p>} error={<p role="alert" className="error">Unable to load this PDF. Refresh the room to check your access and try again.</p>}>
      <Page pageNumber={page} width={width} renderTextLayer={false} renderAnnotationLayer={false} />
    </Document>
  </div>;
}
