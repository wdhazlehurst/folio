import { QueryInput } from "@/types/api";
import { transformToPrisma } from "@/lib/query-builder";

/**
 * A generic function to fetch paginated, filtered, and sorted data
 * @param modelDelegate - e.g., prisma.expense or prisma.expenseCategory
 * @param input - The QueryInput object
 * @param fixedWhere - Hardcoded filters (like userId) for security
 */
export async function getModelData<T, Delegate>(
  modelDelegate: any, // The Prisma delegate (e.g. prisma.expense)
  input: QueryInput<T>,
  fixedWhere: Record<string, any> = {}
) {
  const prismaQuery = transformToPrisma(input);

  // Merge the user-defined filters with our "fixed" security filters
  const finalWhere = {
    ...prismaQuery.where,
    ...fixedWhere,
  };

  const [data, totalCount] = await Promise.all([
    modelDelegate.findMany({
      ...prismaQuery,
      where: finalWhere,
    }),
    modelDelegate.count({
      where: finalWhere,
    }),
  ]);

  return {
    data: data as T[],
    meta: {
      totalCount,
      page: input.pagination.page || 1,
      limit: prismaQuery.take,
      totalPages: Math.ceil(totalCount / (prismaQuery.take || 20)),
    },
  };
}
