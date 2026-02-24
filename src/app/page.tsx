"use client";

import { Container, Text, Title, Stack, Paper } from "@mantine/core";
import Header from "@/components/IndexHeader";

export default function Page() {
  return (
    <>
      <Header />
      <Container size="md" mt="xl">
        <Paper shadow="xs" p="xl" radius="md">
          <Stack>
            <Title order={2}>Welcome to FinanceApp</Title>
            <Text>
              Take control of your personal finances with ease. Track your expenses, set budgets, and monitor your
              savings goals — all in one place.
            </Text>
            <Text>
              FinanceApp is designed to simplify money management so you can focus on what matters most. Whether you
              want to save for a trip, pay off debt, or just get a clearer picture of your spending habits, we’ve got
              you covered.
            </Text>
          </Stack>
        </Paper>
      </Container>
    </>
  );
}
