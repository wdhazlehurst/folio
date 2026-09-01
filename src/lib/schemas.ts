// Zod Validation
import { z } from "zod";
import validator from "validator";
import { MAX_PAGINATION } from "@/constants";

export const emailSchema = z
  .string()
  .trim()
  .refine((v) => validator.isEmail(v), { message: "Invalid Email Format." });

export const passwordSchema = z
  .string()
  .min(6, {
    message: "Password must be at least 6 characters.",
  })
  .superRefine((val, ctx) => {
    if (val.length >= 16) {
      return;
    }

    const rules = [
      { re: /[A-Z]/, msg: "Include at least one uppercase letter (A-Z)." },
      { re: /[a-z]/, msg: "Include at least one lowercase letter (a-z)." },
      { re: /[0-9]/, msg: "Include at least one number (0-9)." },
      { re: /[^A-Za-z0-9]/, msg: "Include at least one special character." },
    ];

    const failed = rules.filter((r) => !r.re.test(val));
    if (!failed.length) {
      return;
    }

    failed.forEach((r) =>
      ctx.addIssue({
        code: "custom",
        message: r.msg,
      })
    );
    ctx.addIssue({
      code: "custom",
      message: "Alternatively, use a 16+ character passphrase",
    });
  });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

const dateStringSchema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" });

/**
 * Operators `QuerySerializer.parseFilters` knows how to map onto Prisma.
 * `.strict()` so an unrecognised operator is rejected rather than silently ignored.
 */
export const FilterOpsSchema = z
  .object({
    // strings
    contains: z.string().optional(),
    eq: z.union([z.string(), z.number(), z.boolean()]).optional(),
    in: z.array(z.union([z.string(), z.number()])).optional(),
    // numbers
    min: z.number().optional(),
    max: z.number().optional(),
    // dates — anything Date can parse, so date-only strings work as well as full ISO
    before: dateStringSchema.optional(),
    after: dateStringSchema.optional(),
  })
  .strict();

export type FilterOpsInput = z.infer<typeof FilterOpsSchema>;

export const PaginationSchema = z.object({
  limit: z
    .number()
    .int("Limit must be a positive integer")
    .positive("Limit must be positive integer")
    .max(MAX_PAGINATION, `Maximum limit is ${MAX_PAGINATION}`)
    .optional(),
  page: z
    .number()
    .int("Page number must be a positive integer")
    .min(1, "Page number must be a positive integer")
    .optional(),
});

/**
 * Builds a query schema bound to one model's field allowlist.
 *
 * Filter and sort keys are validated against `allowedFields` so arbitrary field names can
 * never reach Prisma's `where`/`orderBy`. Allowlists live in `src/lib/query-fields.ts`.
 * There is no `select` here on purpose — the shape returned to the client is the backend's
 * choice, made at the call site.
 */
export function makeQueryInputSchema<F extends string>(allowedFields: readonly [F, ...F[]]) {
  const field = z.enum(allowedFields);

  return z.object({
    // Keys are model fields, values are filter operators
    filters: z.partialRecord(field, FilterOpsSchema).optional(),
    // Keys are model fields, values must be "asc" or "desc"
    sort: z.partialRecord(field, z.enum(["asc", "desc"])).optional(),
    // Page size (limit) and page number (page); both fall back to defaults
    pagination: PaginationSchema.optional(),
  });
}

export type ValidatedQueryInput<F extends string = string> = z.infer<ReturnType<typeof makeQueryInputSchema<F>>>;
