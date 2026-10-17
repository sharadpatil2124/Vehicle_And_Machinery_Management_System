import { Input, Pagination, Table } from './ui';
import usePagedRows from '../hooks/usePagedRows';

export function ReportSearch({ noun, value, onChange }) {
  return (
    <div className="sm:w-64">
      <Input placeholder={`Search ${noun}s...`} aria-label={`Search ${noun}s`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ReportPagination({ paged }) {
  if (!paged.needsControls || paged.total <= paged.pageSize) return null;
  return <Pagination page={paged.page} pages={paged.pages} total={paged.total} pageSize={paged.pageSize} onPageChange={paged.setPage} showPageNumbers />;
}

export default function ReportTable({ title, noun, rows, columns, getRowKey, searchText, defaultSort = null, emptyMessage, subtitle, className = '' }) {
  const paged = usePagedRows(rows, { columns, searchText, defaultSort });
  const showSearch = Boolean(searchText) && paged.needsControls;
  const description = subtitle ? subtitle(paged.sort, columns) : `${rows.length} ${rows.length === 1 ? noun : `${noun}s`}`;

  return (
    <section className={`rounded border border-steel-200 bg-white ${className}`}>
      {(title || showSearch) && (
        <header className="flex flex-col gap-3 border-b border-steel-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h2 className="text-sm font-semibold text-steel-900">{title}</h2>}
            <p className="text-xs text-steel-500">{description}</p>
          </div>
          {showSearch && <ReportSearch noun={noun} value={paged.search} onChange={paged.setSearch} />}
        </header>
      )}
      <Table
        columns={columns}
        rows={paged.visible}
        getRowKey={getRowKey}
        sort={paged.sort}
        onSort={paged.handleSort}
        emptyMessage={paged.term ? `No ${noun}s match "${paged.search.trim()}".` : emptyMessage}
      />
      <ReportPagination paged={paged} />
    </section>
  );
}
