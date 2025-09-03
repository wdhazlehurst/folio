"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard"); // skip login if already logged in
    }
  }, [status, router]);

  if (status === "loading") return null; // or spinner

  return <LoginForm />;
}
