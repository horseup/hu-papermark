import { type ReactNode, useState } from 'react';
import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

export type ColumnMeta = { className?: string };

/**
 * Sortable table on TanStack Table. Rows for which `pinned` returns true (folders)
 * stay above the others whatever the sort; each group follows the chosen order.
 */
export function DataTable<T>({ data, columns, initialSort, getRowId, pinned, label, numbered = false, empty }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: T[]; columns: ColumnDef<T, any>[]; initialSort: SortingState; getRowId: (row: T) => string;
  pinned?: (row: T) => boolean; label: string; numbered?: boolean; empty?: ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getRowId,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), enableSortingRemoval: false });
  const all = table.getRowModel().rows;
  const rows = pinned ? [...all.filter(r => pinned(r.original)), ...all.filter(r => !pinned(r.original))] : all;
  return <div className="table-scroll"><table className="data-table" aria-label={label}>
    <thead>{table.getHeaderGroups().map(group => <tr key={group.id}>
      {numbered && <th scope="col" className="col-num">#</th>}
      {group.headers.map(header => {
        const meta = header.column.columnDef.meta as ColumnMeta | undefined;
        const sorted = header.column.getIsSorted();
        const content = flexRender(header.column.columnDef.header, header.getContext());
        return <th key={header.id} scope="col" className={meta?.className}
          aria-sort={header.column.getCanSort() ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none') : undefined}>
          {header.column.getCanSort()
            ? <button type="button" className={`th-btn${sorted ? ' is-on' : ''}`} onClick={header.column.getToggleSortingHandler()}>
              {content}{sorted === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : sorted === 'desc' ? <ArrowDown size={12} aria-hidden="true" /> : <ChevronsUpDown size={12} aria-hidden="true" className="th-idle" />}
            </button>
            : content}
        </th>;
      })}
    </tr>)}</thead>
    <tbody>{rows.map((row, index) => <tr key={row.id}>
      {numbered && <td className="col-num muted">{String(index + 1).padStart(2, '0')}</td>}
      {row.getVisibleCells().map(cell => <td key={cell.id} className={(cell.column.columnDef.meta as ColumnMeta | undefined)?.className}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
    </tr>)}</tbody>
  </table>{!rows.length && empty}</div>;
}
