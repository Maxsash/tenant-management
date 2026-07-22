import { vi, type Mock } from "vitest";

export interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

export interface QueryBuilder extends PromiseLike<QueryResult> {
  select: Mock;
  eq: Mock;
  order: Mock;
  limit: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  maybeSingle: Mock;
  single: Mock;
}

/**
 * A chainable, awaitable mock mimicking Supabase's query builder. Every
 * chain method returns the same builder so `.select().eq().order()...` works
 * regardless of call order, and the builder is itself thenable so call sites
 * that `await` it directly without a terminal method (e.g. `.delete().eq()`)
 * resolve to `result`.
 */
export function createQueryBuilder(result: QueryResult): QueryBuilder {
  const builder: QueryBuilder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (onResolve, onReject) =>
      Promise.resolve(result).then(onResolve, onReject),
  };

  return builder;
}

/**
 * Configures `fromMock` (the mocked `supabase.from`) to return one query
 * builder per call, in order. Needed for functions that call `.from()` more
 * than once, e.g. `insertExpenseCategory` (sequential) or
 * `isExpenseCategoryInUse` (parallel via Promise.all, but `.from()` itself is
 * still invoked synchronously in source order).
 */
export function mockSupabaseFrom(fromMock: Mock, ...results: QueryResult[]) {
  for (const result of results) {
    fromMock.mockImplementationOnce(() => createQueryBuilder(result));
  }
}

/**
 * Like `mockSupabaseFrom`, but for the single-call case where the test also
 * needs to assert on the builder itself (e.g. which chain methods it was
 * called with).
 */
export function mockSupabaseFromOnce(fromMock: Mock, result: QueryResult): QueryBuilder {
  const builder = createQueryBuilder(result);
  fromMock.mockImplementationOnce(() => builder);
  return builder;
}

export function resetSupabaseMocks(fromMock: Mock) {
  fromMock.mockReset();
}
