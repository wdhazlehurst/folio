"use client";

import { useState } from "react";
import { ScrollArea, Table, Text, TextInput, Select, ActionIcon } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { DatePickerInput } from "@mantine/dates";
import { DIRTY_COLOR } from "@/app/dashboard/_widgets/chart-colors";
import { Expense, ExpenseCategory } from "@/types/expense";
import { toDateInputValue } from "@/lib/format";

type EditableField = "title" | "amount" | "category" | "date";

interface EditingCell {
  rowId: string;
  field: EditableField;
}

const inputProps = {
  size: "xs" as const,
  w: "100%",
};

interface ExpenseTableProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  onUpdateExpense: (expense: Expense) => Promise<void>;
}

interface EditableCellProps {
  rowId: string;
  field: EditableField;
  value: string;
  isEditing: boolean;
  isDirty: boolean;
  draft: Expense | null;
  draftAmount: string;
  categories: ExpenseCategory[];
  categoryOptions: { value: string; label: string }[];
  onStartEdit: (rowId: string, field: EditableField) => void;
  onStopEditing: () => void;
  onDraftChange: <K extends keyof Expense>(key: K, value: Expense[K]) => void;
  onDraftAmountChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/**
 * Module scope on purpose: declaring this inside `ExpenseTable` made it a new
 * component type on every render, so the input unmounted and remounted on each
 * keystroke and lost the caret.
 */
function EditableCell({
  rowId,
  field,
  value,
  isEditing,
  isDirty,
  draft,
  draftAmount,
  categories,
  categoryOptions,
  onStartEdit,
  onStopEditing,
  onDraftChange,
  onDraftAmountChange,
  onCommit,
  onCancel,
}: EditableCellProps) {
  const isRowEditing = draft?.id === rowId;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  if (isEditing) {
    if (field === "title") {
      return (
        <TextInput
          {...inputProps}
          autoFocus
          value={draft?.title ?? ""}
          onChange={(e) => onDraftChange("title", e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      );
    }
    if (field === "category") {
      return (
        <Select
          {...inputProps}
          autoFocus
          data={categoryOptions}
          value={draft?.categoryId ?? null}
          onChange={(categoryId) => {
            if (categoryId) onDraftChange("categoryId", categoryId);
          }}
          onBlur={onStopEditing}
          clearable
        />
      );
    }

    if (field === "date") {
      return (
        <DatePickerInput
          value={toDateInputValue(draft?.date)}
          onBlur={onStopEditing}
          onChange={(d) => {
            // `d` is `YYYY-MM-DD`, which `new Date` parses as UTC midnight — the shape a @db.Date wants.
            if (d) onDraftChange("date", new Date(d));
          }}
        />
      );
    }

    /** Expense amount */
    return (
      <TextInput
        {...inputProps}
        autoFocus
        value={draftAmount}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          const value = e.currentTarget.value;

          // Allow digits and optional decimal with up to 2 places
          if (/^\d*\.?\d{0,2}$/.test(value)) {
            onDraftAmountChange(value);

            // Only update draft if it's a valid number
            const parsed = parseFloat(value);
            if (!isNaN(parsed)) {
              onDraftChange("amount", parsed);
            }
          }
        }}
      />
    );
  }

  let displayValue = value;
  if (isRowEditing && draft) {
    switch (field) {
      case "title":
        displayValue = draft.title;
        break;
      case "amount":
        displayValue = draft.amount.toFixed(2);
        break;
      case "category": {
        const draftCategory = categories.find((c) => c.id === draft.categoryId);
        displayValue = draftCategory?.title ?? "";
        break;
      }
      case "date":
        displayValue = toDateInputValue(draft.date) ?? "";
        break;
    }
  }

  return (
    <Text
      size="sm"
      style={{ cursor: "pointer", fontWeight: isDirty ? 600 : undefined }}
      onClick={() => onStartEdit(rowId, field)}
    >
      {displayValue}
      {isDirty && <span style={{ marginLeft: 6, color: DIRTY_COLOR, fontSize: 12 }}>•</span>}
    </Text>
  );
}

export default function ExpenseTable({ expenses, categories, onUpdateExpense }: ExpenseTableProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [originalExpense, setOriginalExpense] = useState<Expense | null>(null); // Original expense
  const [draftExpense, setDraftExpense] = useState<Expense | null>(null); // Updated expense before submitting
  const [draftAmount, setDraftAmount] = useState<string>(""); // Amount field for draft expense
  const [submitting, setSubmitting] = useState(false);

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

  function handleStartEdit(rowId: string, field: EditableField) {
    if (!isEditingRow(rowId)) {
      const expense = expenses.find((e) => e.id === rowId);
      if (expense) beginExpenseEdit(expense);
    }
    setEditingCell({ rowId, field });
  }

  /** Abandon the row entirely — Escape, or the Cancel path. */
  function handleCancel() {
    setDraftExpense(null);
    setOriginalExpense(null);
    setEditingCell(null);
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

    setSubmitting(true);
    try {
      await onUpdateExpense(draftExpense);
    } finally {
      setSubmitting(false);
    }

    setDraftExpense(null);
    setEditingCell(null);
    setOriginalExpense(null);
  }

  const rows = expenses.map((row) => {
    const cellProps = {
      isEditing: false,
      draft: draftExpense,
      draftAmount,
      categories,
      categoryOptions,
      onStartEdit: handleStartEdit,
      onStopEditing: () => setEditingCell(null),
      onDraftChange: updateDraftExpense,
      onDraftAmountChange: setDraftAmount,
      onCommit: handleSubmit,
      onCancel: handleCancel,
    };

    const isCellEditing = (field: EditableField) =>
      editingCell !== null && editingCell.rowId === row.id && editingCell.field === field;

    return (
      <Table.Tr key={row.id}>
        <Table.Td>
          <EditableCell
            {...cellProps}
            rowId={row.id!}
            field="title"
            value={row.title}
            isEditing={isCellEditing("title")}
            isDirty={isFieldDirty(row.id!, "title")}
          />
        </Table.Td>
        <Table.Td>
          <EditableCell
            {...cellProps}
            rowId={row.id!}
            field="amount"
            value={row.amount.toFixed(2)}
            isEditing={isCellEditing("amount")}
            isDirty={isFieldDirty(row.id!, "amount")}
          />
        </Table.Td>
        <Table.Td>
          <EditableCell
            {...cellProps}
            rowId={row.id!}
            field="category"
            value={categories.find((c) => c.id === row.categoryId)?.title ?? ""}
            isEditing={isCellEditing("category")}
            isDirty={isFieldDirty(row.id!, "category")}
          />
        </Table.Td>
        <Table.Td>
          <EditableCell
            {...cellProps}
            rowId={row.id!}
            field="date"
            value={toDateInputValue(row.date) ?? ""}
            isEditing={isCellEditing("date")}
            isDirty={isFieldDirty(row.id!, "date")}
          />
        </Table.Td>
        <Table.Td align="right">
          {isEditingRow(row.id!) && (
            <ActionIcon variant="outline" aria-label="Submit" loading={submitting} onClick={handleSubmit}>
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
              <Table.Td colSpan={5} style={{ textAlign: "center" }}>
                Nothing found
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
