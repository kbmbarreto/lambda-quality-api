export interface RecordQuery<T> {
  where?: Partial<T>;
  in?: { field: keyof T; values: string[] };
  search?: { fields: (keyof T)[]; value: string };
  compare?: {
    field: keyof T;
    op: 'lt' | 'lte' | 'gt' | 'gte' | 'notNull';
    value?: unknown;
  }[];
  order?: { field: keyof T; direction: 'asc' | 'desc' };
  skip?: number;
  take?: number;
}
export interface Records<T extends { id: string }> {
  find(where: Partial<T>): Promise<T | null>;
  list(query?: RecordQuery<T>): Promise<T[]>;
  count(query?: RecordQuery<T>): Promise<number>;
  create(record: T): Promise<T>;
  update(where: Partial<T>, changes: Partial<T>): Promise<void>;
  remove(where: Partial<T>): Promise<void>;
}
export interface Pagination {
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
export interface Page<T> {
  items: T[];
  pagination: Pagination;
}
export class PageResult<T> implements Page<T> {
  constructor(
    readonly items: T[],
    readonly pagination: Pagination,
  ) {}
}
export interface ListInput {
  page: number;
  size: number;
  q?: string;
  sort?: string;
  status?: string;
  roleId?: string;
  groupId?: string;
}
export function pageResult<T>(
  items: T[],
  input: ListInput,
  totalItems: number,
): Page<T> {
  const totalPages = Math.ceil(totalItems / input.size);
  return new PageResult(items, {
    page: input.page,
    size: input.size,
    totalItems,
    totalPages,
    hasNext: input.page < totalPages,
    hasPrevious: input.page > 1 && totalItems > 0,
  });
}
