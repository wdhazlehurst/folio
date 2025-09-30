"use client";

import { Container, Stack } from "@mantine/core";
import RegisterForm from "./RegisterForm";
import Header from "@/components/IndexHeader";

export default function RegisterPage() {
  return (
    <>
      <Header showSignup={false} />
      <Container size="xl" py="xl">
        <Stack align="center" gap="xl">
          <RegisterForm />
        </Stack>
      </Container>
    </>
  );
}
