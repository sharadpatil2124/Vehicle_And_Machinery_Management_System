function buildListResponse(rows, { page, limit, total }) {
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      pages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

module.exports = { buildListResponse };
