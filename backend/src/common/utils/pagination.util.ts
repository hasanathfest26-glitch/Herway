export interface PaginationParamsInput {
  limit?: string | number;
  skip?: string | number;
  page?: string | number;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface NormalizedPagination {
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T, TMeta = Record<string, unknown>> {
  items: T[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  meta?: TMeta;
}

export function normalizePagination(input: PaginationParamsInput = {}): NormalizedPagination {
  const defaultLimit = input.defaultLimit ?? 25;
  const maxLimit = input.maxLimit ?? 100;
  const parsedLimit = Number(input.limit);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), maxLimit)
    : defaultLimit;

  const parsedSkip = Number(input.skip);
  if (Number.isFinite(parsedSkip) && parsedSkip >= 0) {
    return { limit, skip: Math.floor(parsedSkip) };
  }

  const parsedPage = Number(input.page);
  if (Number.isFinite(parsedPage) && parsedPage >= 1) {
    return { limit, skip: (Math.floor(parsedPage) - 1) * limit };
  }

  return { limit, skip: 0 };
}

export function buildPaginatedResponse<T, TMeta = Record<string, unknown>>(
  items: T[],
  total: number,
  pagination: NormalizedPagination,
  meta?: TMeta,
): PaginatedResponse<T, TMeta> {
  return {
    items,
    total,
    limit: pagination.limit,
    skip: pagination.skip,
    hasMore: pagination.skip + items.length < total,
    ...(meta !== undefined ? { meta } : {}),
  };
}

export function parseBoolFlag(value?: string | boolean): boolean {
  return value === true || value === 'true' || value === '1';
}

export function normalizeSearchQuery(search?: string): string | undefined {
  const trimmed = search?.trim();
  return trimmed ? trimmed : undefined;
}
