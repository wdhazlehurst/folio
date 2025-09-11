"use client";

import { useEffect, useState } from "react";
import { useForm } from "@mantine/form";
import {
  Button,
  Card,
  Group,
  Stack,
  TextInput,
  Text,
  Title,
  Loader,
} from "@mantine/core";

import { addCategory, getUserExpenseCategories } from "./actions";

interface Category {
  id: string;
  title: string;
  description?: string | null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm({
    initialValues: { title: "", description: "" },
    validate: {
      title: (value) => (value.length > 0 ? null : "Title is required"),
    },
  });

  async function loadCategories() {
    setLoading(true);
    const data = await getUserExpenseCategories();
    setCategories(data);
    setLoading(false);
  }

  async function handleAdd(values: { title: string; description: string }) {
    const result = await addCategory(values);
    if (result.ok) {
      form.reset();
      await loadCategories();
    } else {
      alert(result.message);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  return (
    <Stack gap="lg">
      <Title order={2}>Manage Categories</Title>

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
      {loading ? (
        <Loader />
      ) : categories.length === 0 ? (
        <Text c="dimmed">No categories yet. Add one above.</Text>
      ) : (
        <Stack>
          {categories.map((c) => (
            <Card key={c.id} shadow="sm" padding="md" radius="md" withBorder>
              <Text fw={500}>{c.title}</Text>
              {c.description && <Text size="sm" c="dimmed">{c.description}</Text>}
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
