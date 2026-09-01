import type { PagedResult } from "@/types/api";
import type { QuerySerializer } from "@/lib/query-builder";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Structural shape of any Prisma model delegate (e.g. `dbClient.expense`). */
type ModelDelegate = {
  findMany: (args: any) => Promise<any[]>;
  count: (args: any) => Promise<number>;
};

/**
 * Generic paginated read: runs `findMany` and `count` in parallel against the same `where`
 * and returns the rows plus pagination metadata.
 *
 * Tenancy comes from the serializer, which forces `userId` into `where` — there is no separate
 * `fixedWhere` parameter to get wrong.
 *
 * @param modelDelegate Prisma delegate, e.g. `dbClient.expense`
 * @param serializer A `QuerySerializer` already built from the caller's query + field allowlist
 * @param select Prisma `select` shape controlling what leaves the server; the backend's choice
 */
export async function getModelData<T>(
  modelDelegate: ModelDelegate,
  serializer: QuerySerializer<any, any>,
  select?: Record<string, any>
): Promise<PagedResult<T>> {
  const { where, orderBy, take, skip } = serializer.transform();
  const { page, limit } = serializer.pageInfo;

  const [data, totalCount] = await Promise.all([
    modelDelegate.findMany({ where, orderBy, take, skip, ...(select ? { select } : {}) }),
    modelDelegate.count({ where }),
  ]);

  return {
    data: data as T[],
    meta: {
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}
