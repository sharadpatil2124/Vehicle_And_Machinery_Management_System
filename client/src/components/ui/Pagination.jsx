import Button from './Button';

export default function Pagination({ page, pages, total, onPageChange }) {
  return (
    <div className="flex flex-col gap-2 border-t border-steel-200 px-4 py-3 text-sm text-steel-600 sm:flex-row sm:items-center sm:justify-between">
      <p>
        {total} {total === 1 ? 'result' : 'results'}
      </p>

      {pages > 1 && (
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
