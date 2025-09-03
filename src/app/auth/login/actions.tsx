import { signIn } from "next-auth/react";

export async function loginWithCredentials(email: string, password: string) {
  try {
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    // Explicitly check for failed login
    if (!res || res.error) {
      switch (res?.error) {
        case "CredentialsSignin":
          return { success: false, message: "Invalid email or password." };
        case "AccessDenied":
          return { success: false, message: "You do not have permission to sign in." };
        case "Configuration":
          return { success: false, message: "Authentication is not configured properly." };
        default:
          return { success: false, message: "Something went wrong. Please try again." };
      }
    }

    // If we got here → credentials were valid
    return { success: true, message: "Login successful" };
  } catch (err) {
    console.error("Sign-in error:", err);
    return { success: false, message: "Unexpected error during login." };
  }
}
