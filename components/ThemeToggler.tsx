"use client";

import { ActionIcon, useMantineColorScheme } from "@mantine/core";
import { IconSun, IconMoonStars } from "@tabler/icons-react";

export default function ThemeToggler() {
  const { colorScheme, setColorScheme } = useMantineColorScheme({
    keepTransitions: true,
});
  const dark = colorScheme === "dark";

  return (
    <ActionIcon
      onClick={() => setColorScheme(dark ? "light" : "dark")}
      variant="outline"
      color={dark ? "yellow" : "blue"}
      size="lg"
      radius="xl"
      aria-label="Toggle color scheme"
    >
      {dark ? <IconSun size={20} /> : <IconMoonStars size={20} />}
    </ActionIcon>
  );
}
