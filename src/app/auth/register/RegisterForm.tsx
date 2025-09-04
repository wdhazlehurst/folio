"use client";

import { useState } from "react";
import { useForm } from "@mantine/form";
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
} from "@mantine/core";
import { registerUser } from "./actions";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      email: "",
      password: "",
    },

    validate: {
      email: (value) =>
        /^\S+@\S+\.\S+$/.test(value) ? null : "Please enter a valid email",
      password: (value) =>
        value.length < 6 ? "Password must be at least 6 characters" : null,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      await registerUser(values.email, values.password);
      alert("Registration successful!");
      form.reset();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Registration error:", error);
        alert(error.message || "Registration failed");
      }
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xs" py="xl">
      <Paper shadow="md" radius="md" p="xl" withBorder>
        <Title order={2} ta="center" mb="sm" fw={700}>
          Create an Account
        </Title>

        <Text size="sm" c="dimmed" ta="center" mb="lg">
          Sign up to get started with your new account
        </Text>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              required
              {...form.getInputProps("email")}
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              required
              {...form.getInputProps("password")}
            />

            <Button type="submit" fullWidth loading={loading}>
              Register
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
