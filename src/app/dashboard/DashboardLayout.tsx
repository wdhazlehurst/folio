"use client";

import { AppShell, Group } from "@mantine/core";
import LoggedInHeader from "@/components/LoggedInHeader";
import { DashboardNavbar } from "@/components/DashboardNavbar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 200, breakpoint: "sm" }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%">
          <LoggedInHeader />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <DashboardNavbar />
      </AppShell.Navbar>
      {/* Main content */}
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
