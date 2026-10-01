import { computeBookPagination } from '@/utils/pagination';

describe('numerazione delle pagine del libro', () => {
  const lengths = [3000, 6000, 3000];

  it('usa le pagine misurate e stima le altre con la stessa densità', () => {
    // Chapter 1 measured: 6000 chars in 4 pages → 1500 chars/page.
    const measured = new Map([[1, 4]]);
    expect(computeBookPagination(lengths, measured, 1, 0)).toEqual({ page: 3, totalPages: 8, remainingInChapter: 3 });
    expect(computeBookPagination(lengths, measured, 1, 3)).toEqual({ page: 6, totalPages: 8, remainingInChapter: 0 });
  });

  it('diventa esatta man mano che i capitoli vengono impaginati', () => {
    const measured = new Map([
      [0, 3],
      [1, 4],
      [2, 1],
    ]);
    expect(computeBookPagination(lengths, measured, 2, 0)).toEqual({ page: 8, totalPages: 8, remainingInChapter: 0 });
  });

  it('funziona senza misure e con capitoli vuoti', () => {
    const result = computeBookPagination([0, 1500, 1500], new Map(), 0, 0);
    expect(result).toEqual({ page: 1, totalPages: 3, remainingInChapter: 0 });
  });
});
