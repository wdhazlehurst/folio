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
