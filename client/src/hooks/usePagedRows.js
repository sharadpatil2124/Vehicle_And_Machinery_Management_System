import { useMemo, useState } from 'react';

export const REPORT_PAGE_SIZE = 10;

function compare(left, right) {
  if (typeof left === 'string' || typeof right === 'string') return String(left ?? '').localeCompare(String(right ?? ''));
  return (left ?? 0) - (right ?? 0);
}

export default function usePagedRows(rows, { columns = [], searchText, defaultSort = null, pageSize = REPORT_PAGE_SIZE } = {}) {
  const [search, setSearchValue] = useState('');
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);

  const term = search.trim().toLowerCase();
  const sortColumn = sort ? columns.find((c) => c.key === sort.field) : null;

  const sorted = useMemo(() => {
    const filtered = term && searchText ? rows.filter((r) => String(searchText(r) ?? '').toLowerCase().includes(term)) : rows;
    if (!sortColumn?.sortValue) return filtered;
    const direction = sort.direction === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => direction * compare(sortColumn.sortValue(a), sortColumn.sortValue(b)));
  }, [rows, term, searchText, sortColumn, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function setSearch(value) {
    setSearchValue(value);
    setPage(1);
  }

  function handleSort(field) {
    const column = columns.find((c) => c.key === field);
    const isText = rows.length > 0 && typeof column?.sortValue?.(rows[0]) === 'string';
    setSort((s) => ({ field, direction: s?.field === field ? (s.direction === 'desc' ? 'asc' : 'desc') : isText ? 'asc' : 'desc' }));
    setPage(1);
  }

  return {
    visible,
    total: sorted.length,
    page: currentPage,
    pages,
    pageSize,
    setPage,
    search,
    setSearch,
    term,
    sort,
    handleSort,
    needsControls: rows.length > pageSize,
  };
}
