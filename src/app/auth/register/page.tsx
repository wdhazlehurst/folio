"use client";

import { Container, Stack } from "@mantine/core";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <Container size="xs" py="xl">
      <Stack align="center" gap="xl">
        <RegisterForm />
      </Stack>
    </Container>
  );
}
