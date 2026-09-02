import { DEFAULT_PAGINATION } from "@/constants";
import { makeQueryInputSchema, type FilterOpsInput, type ValidatedQueryInput } from "./schemas";
import type { SortDirection } from "@/types/api";

/**
 * The subset of Prisma `findMany` args this layer produces. Values are intentionally loose:
 * `where`/`orderBy` are handed to a delegate whose argument types differ per model, and the
 * call site supplies its own `select`.
 */
export type PrismaQueryArgs = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where: Record<string, any>;
  orderBy?: Record<string, SortDirection>;
  take: number;
  skip: number;
};

/**
 * Validates a raw client query against a model's field allowlist and turns it into Prisma
 * `findMany` args.
 *
 * `Field` is the model's allowlist union (see `query-fields.ts`); constraining it to
 * `Extract<keyof T, string>` means an allowlist can only name columns that actually exist on the
 * model type, so a typo is a compile error rather than a runtime one.
 *
 * @example
 * const serializer = new QuerySerializer<Expense, ExpenseQueryField>(userId, query, EXPENSE_QUERY_FIELDS);
 * const rows = await dbClient.expense.findMany({ ...serializer.transform(), select: { id: true } });
 */
export class QuerySerializer<T, Field extends Extract<keyof T, string> = Extract<keyof T, string>> {
  private validatedData: ValidatedQueryInput<Field>;

  constructor(
    private userId: string,
    rawInput: unknown,
    allowedFields: readonly [Field, ...Field[]]
  ) {
    const result = makeQueryInputSchema(allowedFields).safeParse(rawInput);

    if (!result.success) {
      const errorMsg = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
      throw new Error(errorMsg);
    }

    this.validatedData = result.data;
  }

  /** Page number and page size actually in effect, after defaults. */
  public get pageInfo(): { page: number; limit: number } {
    const { pagination } = this.validatedData;
    return {
      page: pagination?.page ?? 1,
      limit: pagination?.limit ?? DEFAULT_PAGINATION,
    };
  }

  public transform(): PrismaQueryArgs {
    const { filters, sort } = this.validatedData;
    const { page, limit } = this.pageInfo;

    return {
      where: {
        ...this.parseFilters(filters),
        // Forced AFTER the spread — this is the tenancy boundary and must stay last.
        userId: this.userId,
      },
      orderBy: this.parseSort(sort),
      take: limit,
      skip: (page - 1) * limit,
    };
  }

  /** Drops absent keys so the result is a plain `Record<string, SortDirection>` for Prisma. */
  private parseSort(sort: ValidatedQueryInput<Field>["sort"]): Record<string, SortDirection> | undefined {
    if (!sort) return undefined;

    const orderBy: Record<string, SortDirection> = {};
    for (const [key, direction] of Object.entries(sort) as [string, SortDirection | undefined][]) {
      if (direction) orderBy[key] = direction;
    }
    return Object.keys(orderBy).length ? orderBy : undefined;
  }

  private parseFilters(filters: ValidatedQueryInput<Field>["filters"]) {
    if (!filters) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    for (const [key, fieldOps] of Object.entries(filters) as [string, FilterOpsInput | undefined][]) {
      if (!fieldOps) continue;

      // String handling (fuzzy and exact).
      // Tested with `!== undefined`, never truthiness: `eq: false` and `eq: 0` are legitimate
      // filters, and a truthy test silently drops them and returns every row (B17).
      if (fieldOps.contains !== undefined) {
        where[key] = { contains: fieldOps.contains, mode: "insensitive" };
      } else if (fieldOps.eq !== undefined) {
        where[key] = fieldOps.eq;
      } else if (fieldOps.in !== undefined) {
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
}
