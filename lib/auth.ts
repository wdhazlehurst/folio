import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcrypt";
import type { User } from "next-auth";


const prisma = new PrismaClient();

 
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // https://next-auth.js.org/providers/credentials
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
    },

    /**
     * Authorization check against database credentials
     * @param credentials Credentials containing email and password.
     * @returns `null` if credentials are invalid, otherwise returns user object.
     */
    async authorize(credentials, request) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      if (typeof credentials.email !== "string" || typeof credentials.password !== "string") {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });

      if (!user) return null;

      const isValid = await bcrypt.compare(credentials.password, user.password);
      if (!isValid) return null;

      // Any object returned will be saved in `user` property of JWT
      return {
        id: user.id,
        email: user.email,
      } as User;
    },
  }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = String(token.id);
        session.user.email = String(token.email);
      }
      return session;
    }
  }
})