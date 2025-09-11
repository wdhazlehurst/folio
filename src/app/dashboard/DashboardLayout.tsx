"use client";

import { AppShell } from "@mantine/core";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AppShell>
      Coming soon!
      {children}
    </AppShell>
  )
};
