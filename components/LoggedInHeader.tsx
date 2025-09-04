"use client";

import { Group, Title, Button } from "@mantine/core";
import { signOut } from "next-auth/react";
import { IconLogout } from "@tabler/icons-react";
import ThemeToggler from "@/components/ThemeToggler";

export default function LoggedInHeader() {
  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <Group px="md" justify="space-between" h="100%">
      <Title order={4}>Folio</Title>

      <Group>
        <Button
          variant="default"
          onClick={handleLogout}
          leftSection={<IconLogout size={16} />}
        >
          Logout
        </Button>
        <ThemeToggler />
      </Group>
    </Group>
  );
}
