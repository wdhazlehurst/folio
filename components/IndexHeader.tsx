"use client";

import {
  Box,
  Burger,
  Button,
  Divider,
  Drawer,
  Group,
  ScrollArea,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ThemeToggler from "./ThemeToggler";

function IndexHeader() {
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] =
    useDisclosure(false);
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

        <Group visibleFrom="sm">
          <Button variant="default">Log in</Button>
          <Button>Sign up</Button>
        </Group>

        <Burger opened={drawerOpened} onClick={toggleDrawer} hiddenFrom="sm" />
      </header>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        size="100%"
        padding="md"
        title="Navigation"
        hiddenFrom="sm"
        zIndex={1000000}
      >
        <ScrollArea h="calc(100vh - 80px)" mx="-md">
          <Divider my="sm" />
          <Group justify="center" grow pb="xl" px="md">
            <Button variant="default">Log in</Button>
            <Button>Sign up</Button>
          </Group>
        </ScrollArea>
        <ThemeToggler />
      </Drawer>
    </Box>
  );
}

export default IndexHeader;
