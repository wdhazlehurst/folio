"use server";

import { dbClient } from "@/lib/prisma";
import { UserInputError } from "@/lib/errors";
import bcrypt from "bcrypt";
import { SALT_ROUNDS, INVALID_INPUT_ERROR } from "@/constants";
import { signIn } from "next-auth/react";
import { validateEmail, validatePassword } from "@/lib/validators";

type RegisterResult =
  | { ok: true; user: { id: number; email: string } }
  | { ok: false; error: string };

/**
 * API route to handle user registration.
 * @param email User's email address.
 * @param password User's password (to be hashed).
 * @returns A promise that resolves to the created user data or an error message.
 * @throws Error if registration fails from validation, email already exists, or DB issues.
 */
export async function registerUser(
  email: string,
  password: string,
): Promise<RegisterResult> {
  try {
    // Validation
    if (!email || !password) {
      throw new UserInputError("Email and Password are required");
    }
    if (typeof email !== "string" || typeof password !== "string") {
      throw new UserInputError(INVALID_INPUT_ERROR);
    }
    validateEmail(email);
    validatePassword(password);

    // Check if email is already registered
    const existingUser = await dbClient.user.findUnique({ where: { email } });
    if (existingUser) {
      return { ok: false, error: "Email already in use"};
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create the user
    const user = await dbClient.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "USER", // Default role
      },
    });

    // Return user data
    return { ok: true, user };
  } catch (error: unknown) {
    console.error("Error registering user:", error);

    //alert error to user
    if (error instanceof UserInputError) {
      return { ok: false, error: error.message };
    }

    return { ok: false, error: "Registration failed" };
  }
}

/**
 * Logs in a user using NextAuth's signIn method.
 * @param email User provided email
 * @param password User provided password
 * @returns Response from NextAuth signIn
 * @throws Error if login fails
 */
export async function loginUser(email: string, password: string) {
  const res = await signIn("credentials", {
    redirect: false,
    email,
    password,
  });

  if (res?.error) {
    throw new Error(res?.error || "Login failed");
  }
  return res;
}
