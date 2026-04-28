"use client";

import { useState } from "react";
import { useForm } from "@mantine/form";
import { Button, Card, Group, Stack, TextInput, Text, Title, Alert, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AssetCategory } from "@/types/asset";
import { addAssetCategory, updateAssetCategory } from "./actions";

interface AssetCategoryFormProps {
  categories: AssetCategory[];
  onUpdate: () => void;
}

export default function AssetCategoryForm({ categories = [], onUpdate }: AssetCategoryFormProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpened, { open, close }] = useDisclosure(false);
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
    const result = await addAssetCategory(values);
    if (result.ok) {
      form.reset();
      setMessage("Category added successfully");
      close();
      onUpdate();
    } else {
      setError(result.error ?? "Something went wrong");
    }
  }

  async function handleUpdate(id: string, values: { title: string; description: string }) {
    setMessage(null);
    setError(null);
    const result = await updateAssetCategory({ id, title: values.title, description: values.description });
    if (result.ok) {
      setSelected(null);
      setMessage("Category updated successfully");
      onUpdate();
    } else {
      setError(result.error ?? "Something went wrong");
    }
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Asset Categories</Title>

      {message && <Alert color="green">{message}</Alert>}
      {error && <Alert color="red">{error}</Alert>}

      <Modal
        opened={modalOpened}
        onClose={close}
        title="New Asset Category"
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      >
        <form onSubmit={form.onSubmit(handleAdd)}>
          <TextInput
            label="Title"
            placeholder="E.g., Real Estate"
            size="md"
            data-autofocus
            {...form.getInputProps("title")}
          />
          <TextInput
            label="Description"
            placeholder="E.g., Property holdings"
            size="md"
            mt="xs"
            {...form.getInputProps("description")}
          />
          <Group justify="flex-end" mt="md">
            <Button type="submit">Create</Button>
          </Group>
        </form>
      </Modal>

      <Button variant="default" onClick={open}>
        New Category
      </Button>

      {categories.length === 0 ? (
        <Text c="dimmed">No categories yet. Add one above.</Text>
      ) : (
        <Stack>
          {categories.map((c) =>
            selected === c.id ? (
              <Card key={c.id} shadow="sm" padding="md" radius="md" withBorder>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUpdate(c.id, { title: form.values.title, description: form.values.description });
                  }}
                >
                  <Stack gap="xs">
                    <TextInput
                      label="Title"
                      defaultValue={c.title}
                      onChange={(e) => form.setFieldValue("title", e.currentTarget.value)}
                    />
                    <TextInput
                      label="Description"
                      defaultValue={c.description ?? ""}
                      onChange={(e) => form.setFieldValue("description", e.currentTarget.value)}
                    />
                    <Group justify="space-between">
                      <Button type="submit" size="xs">
                        Save
                      </Button>
                      <Button variant="light" color="gray" size="xs" onClick={() => setSelected(null)}>
                        Close
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
                  form.setValues({ title: c.title, description: c.description ?? "" });
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
