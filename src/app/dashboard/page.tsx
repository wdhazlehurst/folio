"use client";

import { useState } from "react";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconHome,
  IconSettings,
  IconChartBar,
  IconReceiptDollar,
  IconCoins
} from "@tabler/icons-react";
import ThemeToggler from "@/components/ThemeToggler";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure();
  const [active, setActive] = useState("home");

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 240,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      {/* HEADER */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Title order={4}>Dashboard</Title>
          </Group>
          <ThemeToggler />
        </Group>
      </AppShell.Header>

      {/* SIDEBAR */}
      <AppShell.Navbar p="md">
        <ScrollArea>
          <NavLink
            label="Home"
            leftSection={<IconHome size={18} />}
            active={active === "home"}
            onClick={() => setActive("home")}
          />
          <NavLink
            label="Expenses"
            leftSection={<IconReceiptDollar size={18} />}
            active={active === "expenses"}
            onClick={() => setActive("expenses")}
          />
          <NavLink
            label="Net Worth"
            leftSection={<IconCoins size={18} />}
            active={active === "worth"}
            onClick={() => setActive("worth")}
          />
          <NavLink
            label="Settings"
            leftSection={<IconSettings size={18} />}
            active={active === "settings"}
            onClick={() => setActive("settings")}
          />
        </ScrollArea>
      </AppShell.Navbar>

      {/* MAIN CONTENT */}
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
