"use client";

import { ActionIcon, useMantineColorScheme } from "@mantine/core";
import { IconSun, IconMoonStars } from "@tabler/icons-react";


export default function ThemeToggler() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <ActionIcon
      onClick={() => setColorScheme(isDark ? "light" : "dark")}
      variant="subtle"
      size="lg"
      radius="xl"
      aria-label="Toggle theme"
    >
      {isDark ? <IconSun size={20} /> : <IconMoonStars size={20} />}
    </ActionIcon>
  );
}
