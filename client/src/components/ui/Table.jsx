export default function Table({ columns, rows, getRowKey, sort, onSort, emptyMessage = 'No records found.' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-steel-200 text-xs font-semibold tracking-wide text-steel-500 uppercase">
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-4 py-3 whitespace-nowrap">
                {column.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-steel-900"
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    {sort?.field === column.key && (
                      <span aria-hidden="true">{sort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-steel-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-steel-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="hover:bg-steel-50">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 whitespace-nowrap text-steel-700">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
