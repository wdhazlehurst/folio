"use server";

import { dbClient } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { SALT_ROUNDS, INVALID_INPUT_ERROR } from "@/constants";
import { signIn } from "next-auth/react";

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
): Promise<{ id: string; email: string }> {
  try {
    if (!email || !password) {
      throw new Error("Email and Password are required");
    }
    if (typeof email !== "string" || typeof password !== "string") {
      throw new Error(INVALID_INPUT_ERROR);
    }

    // Check if email is already registered
    const existingUser = await dbClient.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error("Email already in use");
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
    return { id: user.id, email: user.email };
  } catch (error) {
    console.error("Error registering user:", error);
    throw new Error("Error registering user");
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
