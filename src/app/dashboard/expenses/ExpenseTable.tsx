"use client";

import { useState } from "react";
import { ScrollArea, Table, Text, TextInput, Select, ActionIcon } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
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

interface ExpenseTableProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  onUpdateExpense: (expense: Expense) => Promise<void>;
}

export default function ExpenseTable({ expenses, categories, onUpdateExpense }: ExpenseTableProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [originalExpense, setOriginalExpense] = useState<Expense | null>(null); // Original expense
  const [draftExpense, setDraftExpense] = useState<Expense | null>(null); // Updated expense before submitting
  const [draftAmount, setDraftAmount] = useState<string>(""); // Amount field for draft expense

  function beginExpenseEdit(expense: Expense) {
    setOriginalExpense(expense);
    setDraftExpense({ ...expense });
    setDraftAmount(expense.amount.toFixed(2)); // Always 2 decimals
  }

  /**
   * Update field for expense being edited
   * @param key Field of expense
   * @param value New value for expense field
   */
  function updateDraftExpense<K extends keyof Expense>(key: K, value: Expense[K]) {
    setDraftExpense((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function isEditingRow(rowId: string) {
    return draftExpense?.id === rowId;
  }

  /** Check if a row's field has been edited but not submitted */
  function isFieldDirty(rowId: string, field: EditableField) {
    if (!originalExpense || !draftExpense) return false;

    if (draftExpense.id !== rowId) return false;

    switch (field) {
      case "title":
        return draftExpense.title !== originalExpense.title;
      case "amount":
        return draftExpense.amount !== originalExpense.amount;
      case "category":
        return draftExpense.categoryId !== originalExpense.categoryId;
      case "date":
        return new Date(draftExpense.date).getTime() !== new Date(originalExpense.date).getTime();
      default:
        return false;
    }
  }

  /** Mapping for category title to UUIDs */
  const categoryOptions = categories.map((c) => ({
    value: c.id, // UUID
    label: c.title, // Display value
  }));

  async function handleSubmit() {
    if (!draftExpense || !originalExpense) return;

    const isDirty = JSON.stringify(draftExpense) !== JSON.stringify(originalExpense);

    if (!isDirty) return;

    await onUpdateExpense(draftExpense);

    setDraftExpense(null);
    setEditingCell(null);
    setOriginalExpense(null);
  }

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
    onCommit: (value: string | ExpenseCategory) => void;
    categoryObj?: ExpenseCategory;
  }) {
    const isEditing = editingCell?.rowId === rowId && editingCell.field === field;

    if (isEditing) {
      if (field === "title") {
        return (
          <TextInput
            {...inputProps}
            value={draftExpense?.title.toString() ?? ""}
            onChange={(e) => updateDraftExpense("title", e.currentTarget.value)}
          />
        );
      }
      if (field === "category") {
        return (
          <Select
            {...inputProps}
            data={categoryOptions}
            value={draftExpense?.categoryId ?? null}
            onChange={(categoryId) => {
              if (categoryId) updateDraftExpense("categoryId", categoryId);
            }}
            onBlur={() => setEditingCell(null)}
            clearable
          />
        );
      }

      if (field === "date") {
        return (
          <DatePickerInput
            value={draftExpense?.date ? new Date(draftExpense?.date) : null}
            onBlur={() => setEditingCell(null)}
            onChange={(d) => {
              if (d) updateDraftExpense("date", new Date(d));
            }}
          />
        );
      }

      /** Expense amount */
      return (
        <TextInput
          {...inputProps}
          value={draftAmount}
          onChange={(e) => {
            const value = e.currentTarget.value;

            // Allow digits and optional decimal with up to 2 places
            if (/^\d*\.?\d{0,2}$/.test(value)) {
              setDraftAmount(value);

              // Only update draft if it's a valid number
              const parsed = parseFloat(value);
              if (!isNaN(parsed)) {
                updateDraftExpense("amount", parsed);
              }
            }
          }}
        />
      );
    }

    const original = expenses.find((e) => e.id === rowId);
    const isRowEditing = draftExpense?.id === rowId;

    let displayValue = value;
    if (isRowEditing && draftExpense) {
      switch (field) {
        case "title":
          displayValue = draftExpense.title;
          break;
        case "amount":
          displayValue = draftExpense.amount.toFixed(2);
          break;
        case "category":
          const draftCategory = categories.find((c) => c.id === draftExpense?.categoryId);
          displayValue = draftCategory?.title ?? "";
          break;
        case "date":
          displayValue = draftExpense.date ? new Date(draftExpense.date).toISOString().split("T")[0] : "";
          break;
      }
    }
    return (
      <Text
        size="sm"
        style={{
          cursor: "pointer",
          fontWeight: original && isFieldDirty(rowId, field) ? 600 : undefined,
        }}
        onClick={() => {
          if (!isEditingRow(rowId)) {
            const expense = expenses.find((e) => e.id === rowId);
            if (expense) beginExpenseEdit(expense);
          }
          setEditingCell({ rowId, field });
        }}
      >
        {displayValue}
        {isFieldDirty(rowId, field) && (
          <span
            style={{
              marginLeft: 6,
              color: "#f08c00",
              fontSize: 12,
            }}
          >
            •
          </span>
        )}
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
        <Table.Td align="right">
          {isEditingRow(row.id!) && (
            <ActionIcon variant="outline" aria-label="Submit" onClick={handleSubmit}>
              <IconSend />
            </ActionIcon>
          )}
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
            <Table.Th />
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
