"use client";

import { AppShell } from "@mantine/core";
import LoggedInHeader from "@/components/LoggedInHeader";
import { DashboardNavbar } from "@/components/DashboardNavbar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 175, breakpoint: "md" }}
      padding="md"
    >
      <AppShell.Header>
        <LoggedInHeader />
      </AppShell.Header>
      <AppShell.Navbar>
        <DashboardNavbar />
      </AppShell.Navbar>
      {/* Main content */}
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
