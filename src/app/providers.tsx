"use client";

import { SessionProvider } from "next-auth/react";
import { MantineProvider, localStorageColorSchemeManager } from "@mantine/core";
import "@mantine/core/styles.css";
import { ReactNode } from "react";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <MantineProvider colorSchemeManager={colorSchemeManager}>{children}</MantineProvider>
    </SessionProvider>
  );
}
