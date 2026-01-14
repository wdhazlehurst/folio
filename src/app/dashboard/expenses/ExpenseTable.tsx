"use client";

import { useState } from "react";
import { ScrollArea, Table, Text, TextInput, Select } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { Expense, ExpenseCategory } from "@/types/expense";

type EditableField = "title" | "amount" | "category" | "date";

interface EditingCell {
  rowId: string;
  field: EditableField;
}

const inputProps = {
  size: "xs" as const,
  autoFocus: true,
  w: "100%",
};

interface NewExpenseRow {
  id: string;
  title: string;
  amount: string;
  date: string;
  categoryObj?: ExpenseCategory;
}

interface ExpenseTableProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
}

export default function ExpenseTable({ expenses, categories }: ExpenseTableProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [draftCategory, setDraftCategory] = useState<ExpenseCategory | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.title,
  }));

  function EditableCell({
    rowId,
    field,
    value,
    onCommit,
    categoryObj,
  }: {
    rowId: string;
    field: EditableField;
    value: string;
    onCommit: (value: any) => void;
    categoryObj?: ExpenseCategory;
  }) {
    const isEditing = editingCell?.rowId === rowId && editingCell.field === field;

    const submit = (value: any) => {
      onCommit(value);
      setEditingCell(null);
      setDraftCategory(null);
    };

    if (isEditing) {
      if (field === "category") {
        return (
          <Select
            {...inputProps}
            data={categoryOptions}
            value={draftCategory?.id ?? ""}
            onChange={(id) => {
              const selected = categories.find((c) => c.id === id);
              if (selected) submit(selected); // pass full ExpenseCategory object
            }}
            onBlur={() => setEditingCell(null)}
            clearable
          />
        );
      }

      if (field === "date") {
        return (
          <DatePickerInput
            value={draftValue ? new Date(draftValue) : null}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(draftValue);
              if (e.key === "Escape") setEditingCell(null);
            }}
          />
        );
      }

      return (
        <TextInput
          {...inputProps}
          value={draftValue}
          onChange={(e) => setDraftValue(e.currentTarget.value)}
          onBlur={() => submit(draftValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(draftValue);
            if (e.key === "Escape") setEditingCell(null);
          }}
        />
      );
    }

    return (
      <Text
        size="sm"
        style={{ cursor: "pointer" }}
        onClick={() => {
          setEditingCell({ rowId, field });
          if (field === "category") setDraftCategory(categoryObj ?? null);
          else setDraftValue(value);
        }}
      >
        {field === "category" ? (categoryObj?.title ?? "") : value}
      </Text>
    );
  }

  const rows = expenses.map((row) => {
    const categoryObj = categories.find((c) => c.id === row.categoryId);
    return (
      <Table.Tr key={row.id}>
        <Table.Td>
          <EditableCell
            rowId={row.id!}
            field="title"
            value={row.title}
            onCommit={(v) => console.log("Save title:", v)}
          />
        </Table.Td>
        <Table.Td>
          <EditableCell
            rowId={row.id!}
            field="amount"
            value={row.amount.toFixed(2)}
            onCommit={(v) => console.log("Save amount:", v)}
          />
        </Table.Td>
        <Table.Td>
          <EditableCell
            rowId={row.id!}
            field="category"
            value={categoryObj?.title ?? ""}
            categoryObj={categoryObj}
            onCommit={(v) => console.log("Save category:", v)}
          />
        </Table.Td>
        <Table.Td>
          <EditableCell
            rowId={row.id!}
            field="date"
            value={row.date instanceof Date ? row.date.toISOString().split("T")[0] : row.date}
            onCommit={(v) => console.log("Save date:", v)}
          />
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <ScrollArea>
      <Table miw={800} verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={4} style={{ textAlign: "center" }}>
                Nothing found
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
