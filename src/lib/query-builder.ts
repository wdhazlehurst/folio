"use server";
import { QueryInput } from "@/types/api";

/**
 * Transform query input to a Prisma ORM query
 * @param input Query input, including filters and sorting
 * @returns The Prisma ORM query equivalent
 */
export async function transformToPrisma<T>(input: QueryInput<T>) {
  const where: any = {};

  if (input.filters) {
    Object.entries(input.filters).forEach(([field, ops]: [string, any]) => {
      if (ops.before || ops.after) {
        where[field] = {
          ...(ops.after && { gte: new Date(ops.after) }),
          ...(ops.before && { lte: new Date(ops.before) }),
        };
      } else if (ops.min !== undefined || ops.max !== undefined) {
        where[field] = {
          ...(ops.min !== undefined && { gte: ops.min }),
          ...(ops.max !== undefined && { lte: ops.max }),
        };
      } else if (ops.contains) {
        where[field] = { contains: ops.contains, mode: "insensitive" };
      } else if (ops.eq) {
        where[field] = ops.eq;
      } else if (ops.in) {
        where[field] = { in: ops.in };
      }
    });
  }

  return {
    where,
    orderBy: input.sort,
    take: Math.min(input.pagination.limit || 20, 100),
    skip: ((input.pagination.page || 1) - 1) * (input.pagination.limit || 20),
    // Map select array to Prisma's { field: true } object
    select: input.select?.reduce((acc, field) => ({ ...acc, [field]: true }), {}),
  };
}
