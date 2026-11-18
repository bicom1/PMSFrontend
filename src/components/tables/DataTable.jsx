import { EmptyState, SkeletonRows } from '../common/ui.jsx';

export default function DataTable({ columns, rows, rowKey, loading, emptyTitle, emptyText, onRow }) {
  if (loading) return <SkeletonRows />;
  if (!rows?.length) return <EmptyState title={emptyTitle || 'Nothing here yet'} text={emptyText || 'Records will appear after the clinic starts using this workflow.'} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-base">
        <thead className="border-b border-slate-200 text-sm uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => <th key={column.key} className="px-3 py-3 font-bold">{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={`border-b border-slate-100 transition duration-150 ${row.unread ? 'bg-rose-50/80' : ''} ${onRow ? 'cursor-pointer hover:bg-teal-50' : 'hover:bg-slate-50'}`} onClick={() => onRow?.(row)}>
              {columns.map((column) => <td key={column.key} className="px-3 py-3 align-middle text-slate-700">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
