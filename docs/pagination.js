export const pageSizes = [10, 30, 50];
export function paginate(rows, requestedPage = 0, requestedSize = 10) {
  const size = pageSizes.includes(Number(requestedSize))
    ? Number(requestedSize)
    : 10;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(0, Math.trunc(requestedPage) || 0), pages - 1);
  return {
    page,
    pages,
    size,
    total: rows.length,
    rows: rows.slice(page * size, (page + 1) * size),
  };
}
export function pageSizeOptions(size) {
  return pageSizes
    .map(
      (n) =>
        `<option value="${n}" ${size === n ? "selected" : ""}>${n} 筆</option>`,
    )
    .join("");
}
