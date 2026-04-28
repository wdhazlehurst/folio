"use client";

import { useState } from "react";
import { ScrollArea, Table, Text, TextInput, Select, ActionIcon, Badge } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { DatePickerInput } from "@mantine/dates";
import { Asset, AssetCategory } from "@/types/asset";

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

interface AssetTableProps {
  assets: Asset[];
  categories: AssetCategory[];
  onUpdateAsset: (asset: Asset) => Promise<void>;
}

export default function AssetTable({ assets, categories, onUpdateAsset }: AssetTableProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [originalAsset, setOriginalAsset] = useState<Asset | null>(null);
  const [draftAsset, setDraftAsset] = useState<Asset | null>(null);
  const [draftAmount, setDraftAmount] = useState<string>("");

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
    await onUpdateAsset(draftAsset);
    setDraftAsset(null);
    setEditingCell(null);
    setOriginalAsset(null);
  }

  async function toggleIsCash(asset: Asset) {
    await onUpdateAsset({ ...asset, isCash: !asset.isCash });
  }

  function EditableCell({ rowId, field, value }: { rowId: string; field: EditableField; value: string }) {
    const isEditing = editingCell?.rowId === rowId && editingCell.field === field;

    if (isEditing) {
      if (field === "title") {
        return (
          <TextInput
            {...inputProps}
            value={draftAsset?.title ?? ""}
            onChange={(e) => updateDraftAsset("title", e.currentTarget.value)}
          />
        );
      }
      if (field === "category") {
        return (
          <Select
            {...inputProps}
            data={categoryOptions}
            value={draftAsset?.categoryId ?? null}
            onChange={(categoryId) => {
              updateDraftAsset("categoryId", categoryId ?? null);
              const cat = categories.find((c) => c.id === categoryId);
              updateDraftAsset("category", cat?.title ?? "Uncategorized");
            }}
            onBlur={() => setEditingCell(null)}
            clearable
          />
        );
      }
      if (field === "date") {
        return (
          <DatePickerInput
            value={draftAsset?.date ? new Date(draftAsset.date) : null}
            onBlur={() => setEditingCell(null)}
            onChange={(d) => {
              if (d) updateDraftAsset("date", new Date(d));
            }}
          />
        );
      }
      return (
        <TextInput
          {...inputProps}
          value={draftAmount}
          onChange={(e) => {
            const val = e.currentTarget.value;
            if (/^\d*\.?\d{0,2}$/.test(val)) {
              setDraftAmount(val);
              const parsed = parseFloat(val);
              if (!isNaN(parsed)) updateDraftAsset("amount", parsed);
            }
          }}
        />
      );
    }

    const isRowEditing = draftAsset?.id === rowId;
    let displayValue = value;
    if (isRowEditing && draftAsset) {
      switch (field) {
        case "title":
          displayValue = draftAsset.title;
          break;
        case "amount":
          displayValue = draftAsset.amount.toFixed(2);
          break;
        case "category": {
          const cat = categories.find((c) => c.id === draftAsset.categoryId);
          displayValue = cat?.title ?? "Uncategorized";
          break;
        }
        case "date":
          displayValue = draftAsset.date ? new Date(draftAsset.date).toISOString().split("T")[0] : "";
          break;
      }
    }

    return (
      <Text
        size="sm"
        style={{ cursor: "pointer", fontWeight: isFieldDirty(rowId, field) ? 600 : undefined }}
        onClick={() => {
          if (!isEditingRow(rowId)) {
            const asset = assets.find((a) => a.id === rowId);
            if (asset) beginAssetEdit(asset);
          }
          setEditingCell({ rowId, field });
        }}
      >
        {displayValue}
        {isFieldDirty(rowId, field) && (
          <span style={{ marginLeft: 6, color: "#f08c00", fontSize: 12 }}>•</span>
        )}
      </Text>
    );
  }

  const rows = assets.map((row) => {
    const current = isEditingRow(row.id!) ? draftAsset! : row;
    return (
      <Table.Tr key={row.id}>
        <Table.Td>
          <EditableCell rowId={row.id!} field="title" value={row.title} />
        </Table.Td>
        <Table.Td>
          <EditableCell rowId={row.id!} field="amount" value={row.amount.toFixed(2)} />
        </Table.Td>
        <Table.Td>
          <EditableCell rowId={row.id!} field="category" value={row.category ?? "Uncategorized"} />
        </Table.Td>
        <Table.Td>
          <EditableCell
            rowId={row.id!}
            field="date"
            value={row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date).split("T")[0]}
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
