import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import { Transition } from "@mantine/core";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure user is logged in
  await requireRole(["*"]);

  return <DashboardShell>{children}</DashboardShell>;
}
