export const PAGE_SIZE = 20;

export function pageNumbers(page: number, pageCount: number) {
  const candidates = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [1, page - 1, page, page + 1, pageCount];
  if (pageCount > 7 && page <= 3) candidates.push(2, 3, 4);
  if (pageCount > 7 && page >= pageCount - 2) {
    candidates.push(pageCount - 3, pageCount - 2, pageCount - 1);
  }

  const pages = [...new Set(candidates)]
    .filter(number => number >= 1 && number <= pageCount)
    .sort((a, b) => a - b);
  return pages.flatMap<number | 'gap'>((number, index) => {
    const previous = pages[index - 1];
    if (previous === undefined || number === previous + 1) return [number];
    if (number === previous + 2) return [previous + 1, number];
    return ['gap' as const, number];
  });
}
export function productWindow(
  total: number,
  page: number,
  shown: number,
  desktop: boolean
) {
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.max(0, Math.min(page, Math.max(0, pageCount - 1)));
  const start = desktop ? safePage * PAGE_SIZE : 0;
  const end = Math.min(
    total,
    desktop ? start + PAGE_SIZE : Math.max(PAGE_SIZE, shown)
  );
  return {
    start,
    end,
    page: safePage,
    pageCount,
    remaining: Math.max(0, total - end),
  };
}
