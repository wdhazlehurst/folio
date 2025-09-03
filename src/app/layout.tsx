"use client";

import {
  MantineProvider,
  localStorageColorSchemeManager
} from "@mantine/core";
import "@mantine/core/styles.css";
import { ReactNode } from "react";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme", // Stored in localStorage
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
      </head>
      <body>
        <MantineProvider colorSchemeManager={colorSchemeManager}>
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
