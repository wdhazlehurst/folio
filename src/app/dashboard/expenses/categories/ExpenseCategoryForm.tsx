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

import { addCategory, updateExpenseCategory } from "./actions";

interface Category {
  id: string;
  title: string;
  description?: string | null;
}

interface CategoryManagerProps {
  categories: Category[];
  onUpdate: () => void;
}

export default function CategoryManager({ categories = [], onUpdate }: CategoryManagerProps) {
  const [selected, setSelected] = useState<string | null>(null);
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
      onUpdate();
    } else {
      setError(result.message);
    }
  }

  async function handleUpdate(id: string, values: { title: string; description: string }) {
    setMessage(null);
    setError(null);
    console.log(`RECEIVED ${values.description}`);
    const result = await updateExpenseCategory({
      id,
      title: values.title, 
      description: values.description
    });

    if (result.ok) {
      setSelected(null);
      setMessage("Category updated successfully");
      onUpdate();
    } else {
      setError(result.error);
    }
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Expense Categories</Title>

      {message && <Alert color="green">{message}</Alert>}
      {error && <Alert color="red">{error}</Alert>}

      {/* Add Form */}
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

      {/* Category List */}
      {categories.length === 0 ? (
        <Text c="dimmed">No categories yet. Add one above.</Text>
      ) : (
        <Stack>
          {categories.map((c) =>
            selected === c.id ? (
              <Card
                key={c.id}
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUpdate(c.id, {
                      title: form.values.title,
                      description: form.values.description,
                    });
                  }}
                >
                  <Stack gap="xs">
                    <TextInput
                      label="Title"
                      defaultValue={c.title}
                      onChange={(e) =>
                        form.setFieldValue("title", e.currentTarget.value)
                      }
                    />
                    <TextInput
                      label="Description"
                      defaultValue={c.description ?? ""}
                      onChange={(e) =>
                        form.setFieldValue("description", e.currentTarget.value)
                      }
                    />
                    <Group justify="space-between">
                      <Button type="submit" size="xs">
                        Save
                      </Button>
                      <Button
                        variant="light"
                        color="gray"
                        size="xs"
                        onClick={() => setSelected(null)}
                      >
                        Cancel
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Card>
            ) : (
              <Card
                key={c.id}
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
                onClick={() => {
                  setSelected(c.id);
                  form.setValues({
                    title: c.title,
                    description: c.description ?? "",
                  });
                }}
                style={{ cursor: "pointer" }}
              >
                <Text fw={500}>{c.title}</Text>
                {c.description && (
                  <Text size="sm" c="dimmed">
                    {c.description}
                  </Text>
                )}
              </Card>
            )
          )}
        </Stack>
      )}
    </Stack>
  );
}
