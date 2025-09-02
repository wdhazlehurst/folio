"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "@mantine/form";
import {
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Stack,
  Button,
  Alert,
  Container,
} from "@mantine/core";

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: { email: "", password: "" },
    validate: {
      email: (value) =>
        /^\S+@\S+\.\S+$/.test(value) ? null : "Please enter a valid email",
      password: (value) =>
        value.length < 6 ? "Password must be at least 6 characters" : null,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      redirect: false,
      email: values.email,
      password: values.password,
    });

    if (res?.error) {
      setError(res.error);
    } else {
      router.push("/");
    }

    setLoading(false);
  };

  return (
    <Container size="xs" py="xl">
      <Paper shadow="md" radius="md" p="xl" withBorder>
        <Title order={2} ta="center" mb="sm" fw={700}>
          Log In
        </Title>

        <Text size="sm" c="dimmed" ta="center" mb="lg">
          Enter your credentials to access your account
        </Text>

        {error && <Alert color="red" mb="md">{error}</Alert>}

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
              Log In
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
