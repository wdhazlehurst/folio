// for converting Zod fformat to Mantine
import { z } from "zod";

// Turn a Zod schema into a Mantine `validate` function.
// Mantine expects: () => Record<fieldName, errorMessage>
export function zodValidate<T extends z.ZodTypeAny>(schema: T) {
  return (values: unknown) => {
    // Validate WITHOUT throwing (success flag + error details)
    const parsed = schema.safeParse(values);
    // no errors
    if (parsed.success) return {};

    // We'll collect one string per field (first error wins)
    const out: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      // `path` is an array like ["email"] or ["user","email"]
      // We default to a top-level field key (or "__form" for form-level errors)
      const key =
        issue.path && issue.path.length
          ? String(issue.path[0]) // top-level field name
          : "__form"; // no specific field → show above the form

      // Only set the first error per field (common UX); remove this `if` to concatenate
      if (!out[key]) out[key] = issue.message;
      // If you want to show ALL messages per field, do:
      // else out[key] += " " + issue.message;
    }
    return out;
  };
}
