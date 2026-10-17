import Button from './Button';

function pageWindow(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const items = [];
  for (const n of list) {
    const previous = items[items.length - 1];
    if (typeof previous === 'number' && n - previous === 2) items.push(previous + 1);
    else if (typeof previous === 'number' && n - previous > 2) items.push(`gap-${n}`);
    items.push(n);
  }
  return items;
}

export default function Pagination({ page, pages, total, onPageChange, showPageNumbers = false, pageSize }) {
  const first = pageSize ? (page - 1) * pageSize + 1 : null;
  const last = pageSize ? Math.min(page * pageSize, total) : null;

  return (
    <div className="flex flex-col gap-2 border-t border-steel-200 px-4 py-3 text-sm text-steel-600 sm:flex-row sm:items-center sm:justify-between">
      <p>
        {showPageNumbers && pageSize && pages > 1
          ? `Showing ${first}–${last} of ${total}`
          : `${total} ${total === 1 ? 'result' : 'results'}`}
      </p>

      {pages > 1 && showPageNumbers && (
        <nav aria-label="Pages" className="flex flex-wrap items-center gap-1.5">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          {pageWindow(page, pages).map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className={[
                  'min-w-8 rounded border px-2 py-1 text-xs font-semibold tabular-nums',
                  item === page ? 'border-brand-600 bg-brand-600 text-white' : 'border-steel-200 bg-white text-steel-700 hover:bg-steel-50',
                ].join(' ')}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="px-1 text-steel-500" aria-hidden="true">
                …
              </span>
            )
          )}
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </nav>
      )}

      {pages > 1 && !showPageNumbers && (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
