"use client";

import { useState } from "react";
import { ScrollArea, Table, Text, TextInput, Select, ActionIcon, Badge } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { DatePickerInput } from "@mantine/dates";
import { DIRTY_COLOR } from "@/app/dashboard/_widgets/chart-colors";
import { Asset, AssetCategory } from "@/types/asset";

type EditableField = "title" | "amount" | "category" | "date";

interface EditingCell {
  rowId: string;
  field: EditableField;
}

const inputProps = {
  size: "xs" as const,
  w: "100%",
};

interface AssetTableProps {
  assets: Asset[];
  categories: AssetCategory[];
  onUpdateAsset: (asset: Asset) => Promise<void>;
}

interface EditableCellProps {
  rowId: string;
  field: EditableField;
  value: string;
  isEditing: boolean;
  isDirty: boolean;
  draft: Asset | null;
  draftAmount: string;
  categories: AssetCategory[];
  categoryOptions: { value: string; label: string }[];
  onStartEdit: (rowId: string, field: EditableField) => void;
  onStopEditing: () => void;
  onDraftChange: <K extends keyof Asset>(key: K, value: Asset[K]) => void;
  onDraftAmountChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/**
 * Module scope on purpose: declaring this inside `AssetTable` made it a new
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
            onDraftChange("categoryId", categoryId ?? null);
            // Assets carry a denormalized category title for display (`getUserAssets`
            // flattens it), so it has to be kept in step with the id. Expenses look
            // the title up from `categories` instead and need no equivalent.
            const cat = categories.find((c) => c.id === categoryId);
            onDraftChange("category", cat?.title ?? "Uncategorized");
          }}
          onBlur={onStopEditing}
          clearable
        />
      );
    }
    if (field === "date") {
      return (
        <DatePickerInput
          value={draft?.date ? new Date(draft.date) : null}
          onBlur={onStopEditing}
          onChange={(d) => {
            if (d) onDraftChange("date", new Date(d));
          }}
        />
      );
    }
    return (
      <TextInput
        {...inputProps}
        autoFocus
        value={draftAmount}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          const val = e.currentTarget.value;
          if (/^\d*\.?\d{0,2}$/.test(val)) {
            onDraftAmountChange(val);
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) onDraftChange("amount", parsed);
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
        const cat = categories.find((c) => c.id === draft.categoryId);
        displayValue = cat?.title ?? "Uncategorized";
        break;
      }
      case "date":
        displayValue = draft.date ? new Date(draft.date).toISOString().split("T")[0] : "";
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

export default function AssetTable({ assets, categories, onUpdateAsset }: AssetTableProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [originalAsset, setOriginalAsset] = useState<Asset | null>(null);
  const [draftAsset, setDraftAsset] = useState<Asset | null>(null);
  const [draftAmount, setDraftAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  function beginAssetEdit(asset: Asset) {
    setOriginalAsset(asset);
    setDraftAsset({ ...asset });
    setDraftAmount(asset.amount.toFixed(2));
  }

  function updateDraftAsset<K extends keyof Asset>(key: K, value: Asset[K]) {
    setDraftAsset((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function isEditingRow(rowId: string) {
    return draftAsset?.id === rowId;
  }

  function handleStartEdit(rowId: string, field: EditableField) {
    if (!isEditingRow(rowId)) {
      const asset = assets.find((a) => a.id === rowId);
      if (asset) beginAssetEdit(asset);
    }
    setEditingCell({ rowId, field });
  }

  /** Abandon the row entirely — Escape, or the Cancel path. */
  function handleCancel() {
    setDraftAsset(null);
    setOriginalAsset(null);
    setEditingCell(null);
  }

  function isFieldDirty(rowId: string, field: EditableField) {
    if (!originalAsset || !draftAsset || draftAsset.id !== rowId) return false;
    switch (field) {
      case "title":
        return draftAsset.title !== originalAsset.title;
      case "amount":
        return draftAsset.amount !== originalAsset.amount;
      case "category":
        return draftAsset.categoryId !== originalAsset.categoryId;
      case "date":
        return new Date(draftAsset.date).getTime() !== new Date(originalAsset.date).getTime();
      default:
        return false;
    }
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.title }));

  async function handleSubmit() {
    if (!draftAsset || !originalAsset) return;
    if (JSON.stringify(draftAsset) === JSON.stringify(originalAsset)) return;

    setSubmitting(true);
    try {
      await onUpdateAsset(draftAsset);
    } finally {
      setSubmitting(false);
    }

    setDraftAsset(null);
    setEditingCell(null);
    setOriginalAsset(null);
  }

  async function toggleIsCash(asset: Asset) {
    await onUpdateAsset({ ...asset, isCash: !asset.isCash });
  }

  const rows = assets.map((row) => {
    const current = isEditingRow(row.id!) ? draftAsset! : row;

    const cellProps = {
      draft: draftAsset,
      draftAmount,
      categories,
      categoryOptions,
      onStartEdit: handleStartEdit,
      onStopEditing: () => setEditingCell(null),
      onDraftChange: updateDraftAsset,
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
            value={row.category ?? "Uncategorized"}
            isEditing={isCellEditing("category")}
            isDirty={isFieldDirty(row.id!, "category")}
          />
        </Table.Td>
        <Table.Td>
          <EditableCell
            {...cellProps}
            rowId={row.id!}
            field="date"
            value={row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date).split("T")[0]}
            isEditing={isCellEditing("date")}
            isDirty={isFieldDirty(row.id!, "date")}
          />
        </Table.Td>
        <Table.Td>
          <Badge
            color={current.isCash ? "teal" : "gray"}
            variant="light"
            style={{ cursor: "pointer" }}
            onClick={() => toggleIsCash(current)}
          >
            {current.isCash ? "Liquid" : "Illiquid"}
          </Badge>
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
      <Table miw={900} verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th>Liquid</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: "center" }}>
                Nothing found
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
