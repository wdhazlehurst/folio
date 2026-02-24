import { emailSchema, passwordSchema } from "./schemas";
import { UserInputError } from "./errors";
// import { z } from "zod";

export function validateEmail(email: string) {
  const result = emailSchema.safeParse(email);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "Invalid Email Format";
    throw new UserInputError(msg);
  }
  return null;
}

export function validatePassword(password: string) {
  const result = passwordSchema.safeParse(password);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join(" ") || "Password does not meet complexity requirements";
    throw new UserInputError(msg);
  }
  return null;
}
