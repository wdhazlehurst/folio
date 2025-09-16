"use client";

import { AppShell } from "@mantine/core";
import LoggedInHeader from "@/components/LoggedInHeader";
import { DashboardNavbar } from "@/components/DashboardNavbar";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion"

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();

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
      <AppShell.Main>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10}}
            animate={{ opacity: 1, y: 0}}
            transition={{ duration: 0.25, ease: "easeIn"}}>
              {children}
            </motion.div>
        </AnimatePresence>
      </AppShell.Main>
    </AppShell>
  );
}
