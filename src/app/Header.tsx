"use client";

import { useMantineColorScheme, ActionIcon, Group, Title } from "@mantine/core";
export default function Header() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";

  return (
    <Group justify="space-between" p="md">
      <Title order={3}>My App</Title>
    </Group>
  );
}