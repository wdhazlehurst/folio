import { NextResponse } from "next/server";
import { PrismaClient } from "../../../../../generated/prisma";
import bcrypt from "bcrypt";


/**
 * API route to handle user registration.
 * @param request Request object containing user registration data.
 * @returns JSON response with user data or error message.
 */
export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
        }

        // Ceheck if email is already registered
        const existingUser = await new PrismaClient().user.findUnique({where: { email }});
        if (existingUser) {
            return NextResponse.json({ error: "Email already in use" }, { status: 409 });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await new PrismaClient().user.create({
            data: {
                email,
                password: hashedPassword,
                role: "USER", // Default role
            },
        });

        // Return user data
        return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
    } catch (error) {
        console.error("Error registering user:", error);
        return NextResponse.json({ error: "Error registering user" }, { status: 500 });
    }
}
