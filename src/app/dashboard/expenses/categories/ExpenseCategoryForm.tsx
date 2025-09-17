"use client";

import { useState } from "react";
import { useForm } from "@mantine/form";
import {
  Button,
  Card,
  Group,
  Stack,
  TextInput,
  Text,
  Title,
  Alert,
} from "@mantine/core";

import { addCategory } from "./actions";

interface Category {
  id: string;
  title: string;
  description?: string | null;
}

interface CategoryManagerProps {
  categories: Category[];
  onUpdate: () => void; // parent refresh function
}

export default function CategoryManager({ categories = [], onUpdate }: CategoryManagerProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: { title: "", description: "" },
    validate: {
      title: (value) => (value.length > 0 ? null : "Title is required"),
    },
  });

  async function handleAdd(values: { title: string; description: string }) {
    setMessage(null);
    setError(null);
    const result = await addCategory(values);

    if (result.ok) {
      form.reset();
      setMessage("Category added successfully");
      onUpdate(); // Trigger parent refresh
    } else {
      setError(result.message);
    }
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Expense Categories</Title>

      {message && (
        <Alert color="green" mb="md">
          {message}
        </Alert>
      )}
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={form.onSubmit(handleAdd)}>
        <Group align="flex-end" gap="md">
          <TextInput
            label="Title"
            placeholder="e.g. Groceries"
            {...form.getInputProps("title")}
          />
          <TextInput
            label="Description (optional)"
            placeholder="e.g. Monthly food expenses"
            {...form.getInputProps("description")}
          />
          <Button type="submit">Add</Button>
        </Group>
      </form>

      {/* List */}
      {categories.length === 0 ? (
        <Text c="dimmed">No categories yet. Add one above.</Text>
      ) : (
        <Stack>
          {categories.map((c) => (
            <Card key={c.id} shadow="sm" padding="md" radius="md" withBorder>
              <Text fw={500}>{c.title}</Text>
              {c.description && (
                <Text size="sm" c="dimmed">
                  {c.description}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
