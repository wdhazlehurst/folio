import "next-auth";

/**
 * Extending the NextAuth User for custom implementation.
 */
declare module "next-auth" {
  export interface User {
    id: integer;
    email: string;
  }
}

export type UserRegisterResult =
  | { ok: true; user: { id: string; email: string; } }
  | { ok: false; error: string };

export type UserLoginResult =
  | { ok: true }
  | { ok: false; error: string };