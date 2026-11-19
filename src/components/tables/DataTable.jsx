import { EmptyState, SkeletonRows } from '../common/ui.jsx';

function cellValue(column, row) {
  if (column.render) return column.render(row);
  const value = row[column.key];
  return value == null || value === '' ? '—' : value;
}

export default function DataTable({ columns, rows, rowKey, loading, emptyTitle, emptyText, onRow }) {
  if (loading) return <SkeletonRows />;
  if (!rows?.length) return <EmptyState title={emptyTitle || 'Nothing here yet'} text={emptyText || 'Records will appear after the clinic starts using this workflow.'} />;

  const details = columns.filter((column) => column.header);
  const actions = columns.filter((column) => !column.header);

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article
            key={rowKey(row)}
            className={`rounded-2xl border border-slate-200 p-4 ${row.unread ? 'bg-rose-50/80' : 'bg-slate-50'} ${onRow ? 'cursor-pointer' : ''}`}
            onClick={() => onRow?.(row)}
          >
            <dl className="space-y-2">
              {details.map((column) => (
                <div key={column.key} className="grid grid-cols-1 gap-0.5 min-[380px]:grid-cols-[7.5rem_minmax(0,1fr)] min-[380px]:items-start min-[380px]:gap-3">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{column.header}</dt>
                  <dd className="min-w-0 break-words text-base font-bold text-slate-800">{cellValue(column, row)}</dd>
                </div>
              ))}
            </dl>
            {actions.length > 0 && (
              <div className="mt-3 grid gap-2 [&_button]:w-full" onClick={(event) => event.stopPropagation()}>
                {actions.map((column) => <div key={column.key}>{cellValue(column, row)}</div>)}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
        <table className="min-w-full text-left text-base">
          <thead className="border-b border-slate-200 text-sm uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-3 font-bold">{column.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className={`border-b border-slate-100 transition duration-150 ${row.unread ? 'bg-rose-50/80' : ''} ${onRow ? 'cursor-pointer hover:bg-teal-50' : 'hover:bg-slate-50'}`} onClick={() => onRow?.(row)}>
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-3 py-3 align-middle text-slate-700" onClick={column.header ? undefined : (event) => event.stopPropagation()}>
                    {cellValue(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
