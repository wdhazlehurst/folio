import { MAX_PAGINATION, DEFAULT_PAGINATION } from "@/constants";
import { QueryInput, QueryInputSchema } from "./schemas";

export class QuerySerializer<T> {
  private validatedData: QueryInput;

  constructor(
    private userId: string,
    rawInput: any
  ) {
    const result = QueryInputSchema.safeParse(rawInput);

    if (!result.success) {
      const errorMsg = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
      throw new Error(errorMsg);
    }

    this.validatedData = result.data;
  }

  public transform() {
    const { filters, sort, select, pagination } = this.validatedData;

    return {
      where: {
        ...this.parseFilters(filters),
        userId: this.userId,
      },
      orderBy: sort,
      take: pagination.limit || DEFAULT_PAGINATION,
      skip: ((pagination.page || 1) - 1) * (pagination.limit || DEFAULT_PAGINATION),
      select: select?.reduce((acc, field) => ({ ...acc, [field]: true }), {}),
    };
  }

  private parseFilters(filters: any) {
    if (!filters) return {};

    const where: any = {};

    for (const [key, ops] of Object.entries(filters)) {
      const fieldOps: any = ops;

      //String handling (Fuzzy and exact)
      if (fieldOps.contains) {
        where[key] = { contains: fieldOps.contains, mode: "insensitive" };
      } else if (fieldOps.eq) {
        where[key] = fieldOps.eq;
      } else if (fieldOps.in) {
        where[key] = { in: fieldOps.in };
      }

      // Numerical handling (min/max -> gte/lte)
      if (fieldOps.min !== undefined || fieldOps.max !== undefined) {
        where[key] = {
          ...(fieldOps.min !== undefined && { gte: fieldOps.min }),
          ...(fieldOps.max !== undefined && { lte: fieldOps.max }),
        };
      }

      // Date handling (before/after -> lt/gt)
      if (fieldOps.before || fieldOps.after) {
        where[key] = {
          ...(fieldOps.before && { lt: new Date(fieldOps.before) }),
          ...(fieldOps.after && { gt: new Date(fieldOps.after) }),
        };
      }
    }
    return where;
  }
