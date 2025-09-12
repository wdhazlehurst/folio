// Zod Validation
import { z } from "zod";
import validator from "validator";

export const emailSchema = z
    .string()
    .trim()
    .refine((v) => validator.isEmail(v), { message: "Invalid Email Format."});

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
        ]

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
            message: "Alternatively, use a 16+ character passphrase"
        });
    });

export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;