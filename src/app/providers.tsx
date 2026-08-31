"use client";

import { SessionProvider } from "next-auth/react";
import { MantineProvider, createTheme, localStorageColorSchemeManager } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/dates/styles.css";
import { ReactNode } from "react";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji",
  headings: { fontWeight: "600" },
  components: {
    // Modal/Drawer content are Paper-based, so only shadow is safe to default here.
    Paper: { defaultProps: { shadow: "none" } },
    Card: { defaultProps: { shadow: "none", withBorder: true } },
  },
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <MantineProvider theme={theme} colorSchemeManager={colorSchemeManager}>
        {children}
      </MantineProvider>
    </SessionProvider>
  );
}
