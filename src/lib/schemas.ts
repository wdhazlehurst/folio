// Zod Validation
import { z } from "zod";
import validator from "validator";
import { MAX_PAGINATION, DEFAULT_PAGINATION } from "@/constants";
import { Decimal } from "@prisma/client/runtime/library";

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

export type FilterOps<T> = T extends Date
  ? { before?: string; after?: string }
  : T extends number | Decimal
    ? { min?: number; max?: number }
    : T extends string
      ? { contains?: string; eq?: string; in?: string[] }
      : { eq?: T };

export const QueryInputSchema = z.object({
  // Keys are model fields, values are FilterOps
  filters: z.record(z.string(), z.any()).optional(),
  // Keys are model fields, values must be "asc" or "desc"
  sort: z.record(z.string(), z.enum(["asc", "desc"])).optional(),
  // There should be a "select" parameter as well, but that is chosen by the backend

  // Pagination includes the page size (limit) and page number (page)
  pagination: z.object({
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
  }),
});

export type QueryInput = z.infer<typeof QueryInputSchema>;
