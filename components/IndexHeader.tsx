"use client";

import { Box, Button, Group, Text, useMantineTheme } from "@mantine/core";
import ThemeToggler from "./ThemeToggler";
import Link from "next/link";

interface HeaderProps {
  showLogin?: boolean;
  showSignup?: boolean;
}

function IndexHeader({ showLogin = true, showSignup = true }: HeaderProps) {
  const theme = useMantineTheme();

  return (
    <Box pb={60}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem",
          borderBottom: `1px solid ${theme.colors.gray[3]}`,
        }}
      >
        <Text fw={700} size="lg">
          Folio
        </Text>

        <Group>
          {showLogin && (
            <Button variant="default" component={Link} href="/auth/login">
              Log in
            </Button>
          )}
          {showSignup && (
            <Button component={Link} href="/auth/register">
              Sign up
            </Button>
          )}
          <ThemeToggler />
        </Group>
      </header>
    </Box>
  );
}

export default IndexHeader;
