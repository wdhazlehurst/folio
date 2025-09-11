import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure user is logged in
  await requireRole(["*"]);

  return <DashboardShell>{children}</DashboardShell>;
}
