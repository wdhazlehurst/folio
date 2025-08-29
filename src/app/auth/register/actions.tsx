"use server";

import { dbClient } from "@/lib/prisma"
import bcrypt from "bcrypt";

/**
 * API route to handle user registration.
 * @param request Request object containing user registration data.
 * @returns JSON response with user data or error message.
 */
export default async function registerUser(
    email: string, password: string
) {
    try {
        console.log('email:', email, 'password:', password);
        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
            throw new Error("Invalid field(s)")
        }

        // Check if email is already registered
        const existingUser = await dbClient.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new Error("Email already in use")
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

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
