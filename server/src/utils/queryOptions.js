const AppError = require('./AppError');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function parseListQuery(query, { sortableFields, defaultSort }) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT));

  const [defaultField, defaultDirection] = defaultSort.split(':');
  const [rawField, rawDirection] = typeof query.sort === 'string' ? query.sort.split(':') : [];

  const field = sortableFields.includes(rawField) ? rawField : defaultField;
  const direction = rawDirection?.toLowerCase() === 'asc' ? 'ASC' : rawDirection?.toLowerCase() === 'desc' ? 'DESC' : (defaultDirection ?? 'DESC').toUpperCase();

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    order: [[field, direction]],
  };
}

function parseEnumFilter(value, allowed, label) {
  if (value === undefined || value === '') return undefined;
  if (!allowed.includes(value)) {
    throw AppError.badRequest(`${label} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

module.exports = { parseListQuery, parseEnumFilter, MAX_LIMIT, DEFAULT_LIMIT };
