import { useEffect, useState } from 'react';

// Read-only spreadsheet preview with SheetJS, entirely in the browser: the file comes
// from our own access-checked endpoint and is never sent anywhere else. Values are the
// ones Excel last saved (formulas are not recalculated); charts and most formatting are
// not shown. Large sheets are cut to keep the page responsive.
const MAX_ROWS = 1000;
const MAX_COLS = 50;
type Sheet = { name: string; rows: string[][]; truncatedRows: boolean; truncatedCols: boolean; width: number };

function columnName(index: number) {
  let name = ''; let n = index + 1;
  while (n > 0) { const r = (n - 1) % 26; name = String.fromCharCode(65 + r) + name; n = Math.floor((n - 1) / 26); }
  return name;
}

export default function SheetPreview({ url, downloadHref }: { url: string; downloadHref?: string }) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setSheets(null); setError(''); setActive(0);
    (async () => {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('The spreadsheet could not be loaded.');
      const buffer = await response.arrayBuffer();
      const XLSX = await import('xlsx');
      // sheetRows reads one extra row so we know whether the sheet was cut.
      const book = XLSX.read(buffer, { type: 'array', cellDates: true, sheetRows: MAX_ROWS + 1, cellHTML: false, cellFormula: false });
      const result = book.SheetNames.map(name => {
        const raw = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, raw: false, defval: '', blankrows: true });
        const width = raw.reduce((max, row) => Math.max(max, row.length), 0);
        return { name, rows: raw.slice(0, MAX_ROWS).map(row => row.slice(0, MAX_COLS).map(cell => String(cell ?? ''))),
          truncatedRows: raw.length > MAX_ROWS, truncatedCols: width > MAX_COLS, width: Math.min(width, MAX_COLS) };
      });
      if (!cancelled) setSheets(result);
    })().catch(err => { if (!cancelled) setError((err as Error).message || 'The spreadsheet could not be shown.'); });
    return () => { cancelled = true; };
  }, [url]);

  if (error) return <div className="preview-card"><p role="alert" className="error">{error}</p>{downloadHref && <a className="solid" href={downloadHref} download>Download to open</a>}</div>;
  if (!sheets) return <p role="status" className="muted">Loading spreadsheet…</p>;
  const sheet = sheets[active] ?? sheets[0];
  const width = Math.max(sheet?.width ?? 0, 1);
  return <div className="sheet">
    <div className="sheet-note"><span>Read-only preview · values as last saved · formatting simplified</span>
      <span>{sheets.length > 1 ? `Sheet ${active + 1} of ${sheets.length}` : ''}</span></div>
    <div className="sheet-scroll" tabIndex={0} aria-label={`${sheet?.name ?? 'Sheet'} preview`}>
      {sheet && sheet.rows.length ? <table className="xl">
        <thead><tr><th scope="col"><span className="visually-hidden">Row</span></th>{Array.from({ length: width }, (_, c) => <th key={c} scope="col">{columnName(c)}</th>)}</tr></thead>
        <tbody>{sheet.rows.map((row, r) => <tr key={r}><th scope="row">{r + 1}</th>
          {Array.from({ length: width }, (_, c) => { const value = row[c] ?? ''; return <td key={c} className={value && !/^[-+]?[\d.,\s%€$£]+$/.test(value) ? 't' : undefined}>{value}</td>; })}
        </tr>)}</tbody>
      </table> : <p className="muted sheet-empty">This sheet is empty.</p>}
    </div>
    {(sheet?.truncatedRows || sheet?.truncatedCols) && <p className="sheet-note">Showing the first {MAX_ROWS} rows and {MAX_COLS} columns. Download the file for everything.</p>}
    {sheets.length > 1 && <div className="sheet-tabs" role="tablist" aria-label="Sheets">
      {sheets.map((s, i) => <button key={s.name + i} type="button" role="tab" aria-selected={i === active} className={`sheet-tab${i === active ? ' is-on' : ''}`} onClick={() => setActive(i)}>{s.name}</button>)}
    </div>}
  </div>;
}
