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
  Alert,
  Center,
  Box,
  Progress,
  Group,
  Grid,
  SimpleGrid,
  Skeleton,
  Divider
} from "@mantine/core";
import { registerUser } from "./actions";
import { signIn } from "next-auth/react";
import { IconX, IconCheck } from "@tabler/icons-react";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const res = await registerUser(values.email, values.password);

      if (!res.ok) {
        console.error("Registration Error: ", res.error);
        setError(res.error);
        return;
      }

      alert("Registration successful");
      await signIn("credentials", {
        redirect: true,
        email: values.email,
        password: values.password,
        callbackUrl: "/dashboard",
      });
    } catch (error) {
      console.error("Unexpected error", error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  function PasswordRequirement({ meets, label }: { meets: boolean; label: string }) {
    return (
      <Text component="div" c={meets ? 'teal' : 'red'} p="3" size="sm">
        <Center inline>
          {meets ? <IconCheck size={14} stroke={1.5} /> : <IconX size={14} stroke={1.5} />}
          <Box ml={7}>{label}</Box>
        </Center>
      </Text>
    );
  }

  const requirements = [
    { re: /[0-9]/, label: "Includes number" },
    { re: /[a-z]/, label: "Includes lowercase letter" },
    { re: /[A-Z]/, label: "Includes uppercase letter" },
    { re: /[$&+,:;=?@#|'<>.^*()%!-]/, label: "Includes special symbol" },
  ];

  function getStrength(password: string) {
    if (password.length >= 16) {
      return 100;
    }
    let multiplier = password.length > 5 ? 0 : 1;
    requirements.forEach((requirement) => {
      if (!requirement.re.test(password)) {
        multiplier += 1;
      }
    });
    return Math.max(100 - (100 / (requirements.length + 1)) * multiplier, 0);
  }

  const [value, setvalue] = useState("");
  const strength = getStrength(value);
  const checks = requirements.map((requirement, index) => (
    <PasswordRequirement key={index} label={requirement.label} meets={requirement.re.test(value)} />
  ));

  const bars1 = Array(4)
    .fill(0)
    .map((_, index) => (
      <Progress
        styles={{ section: { transitionDuration: "0ms" } }}
        value={
          value.length > 0 && index === 0 ? 100 : strength >= ((index + 1) /4) * 100 ? 100: 0
        }
        color={strength > 80 ? "teal" : strength > 50 ? "yellow" : "red"}
        key={index}
        size={4}
      />
    ));

  return (
    <Container size="xl" py="xl">
      <Stack>
        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}
      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper shadow="md" radius="md" p="lg" withBorder>
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
              value={value}
              onChange={(event) => {
                setvalue(event.currentTarget.value);
                form.setFieldValue("password", event.currentTarget.value);
              }}
              label="Password"
              placeholder="Enter your password"
              required
            />
            <Stack
              align="stretch"
              justify="flex-start"
              gap="xs"
              >
              <Group gap={5} grow mt="xs" mb="md">
                {bars1}
              </Group>
            </Stack>

            <Button type="submit" fullWidth loading={loading}>
              Register
            </Button>
          </Stack>
        </form>
      </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md:6 }}>
      <Paper radius="md" p="lg" >
        <Title order={3} ta="center" mb="sm" fw={700}>
          Password Requirements
        </Title>

        <Text size="sm" c="dimmed" ta="center" mb="lg">
          Meet either of our password requirements
        </Text>

            <Stack
              align="stretch"
              justify="flex-start"
              gap="xs"
              >
              <PasswordRequirement label="Has at least 6 characters" meets={value.length > 5} />
              {checks}
            </Stack>
            <Divider label="Or" labelPosition="center" p="lg"/>
        <PasswordRequirement label="Has at least 16 characters" meets={value.length >= 16} />
      </Paper>
      </Grid.Col>
      </Grid>
      </Stack>
    </Container>
  );
}
