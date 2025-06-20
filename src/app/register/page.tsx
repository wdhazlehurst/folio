"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
            const data = await res.json();
            console.log("User registered:", data);
            router.push("/login"); // Redirect to login page after successful registration
        } else {
            const errorData = await res.json();
            console.error("Registration error:", errorData);
            alert(errorData.error || "Registration failed");
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <input 
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <input 
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <button type="submit">Register</button>
        </form>
    )
}