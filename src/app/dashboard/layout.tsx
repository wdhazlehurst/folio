import { requireRole } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure user is logged in
  await requireRole(["*"]);

  return <section>{children}</section>;
}
