"use client";

import { ActionIcon, Badge, Group, Table, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { formatCurrency, formatDay } from "@/lib/format";
import type { EarningView } from "@/types/earning";

const STATUS_STYLE = {
  PROJECTED: { color: "yellow", label: "Awaiting confirmation" },
  CONFIRMED: { color: "green", label: "Confirmed" },
  CANCELLED: { color: "gray", label: "Cancelled" },
} as const;

interface EarningsTableProps {
  earnings: EarningView[];
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit: (earning: EarningView) => void;
  onDelete: (earning: EarningView) => void;
}

/**
 * Materialised occurrences — real rows, so every one is editable and deletable.
 * Rows that came from a rule show the rule's name; one-offs show "One-off".
 */
export default function EarningsTable({ earnings, onConfirm, onCancel, onEdit, onDelete }: EarningsTableProps) {
  if (!earnings.length) {
    return (
      <Text c="dimmed" size="sm">
        No income recorded yet. Create a rule and it will post here once a pay date passes, or add a one-off.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={720}>
      <Table striped highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th ta="right">Gross</Table.Th>
            <Table.Th ta="right">Net</Table.Th>
            <Table.Th ta="right">Allocated</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {earnings.map((earning) => {
            const status = STATUS_STYLE[earning.status];
            return (
              <Table.Tr key={earning.id}>
                <Table.Td>{formatDay(earning.date)}</Table.Td>
                <Table.Td>{earning.title}</Table.Td>
                <Table.Td>
                  <Text size="sm" c={earning.ruleTitle ? undefined : "dimmed"}>
                    {earning.ruleTitle ?? "One-off"}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">{formatCurrency(earning.grossAmount)}</Table.Td>
                <Table.Td ta="right">{formatCurrency(earning.netAmount)}</Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" c={earning.allocatedAmount > 0 ? undefined : "dimmed"}>
                    {formatCurrency(earning.allocatedAmount)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={status.color} variant="light">
                    {status.label}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    {earning.status === "PROJECTED" && (
                      <>
                        <Tooltip label="Confirm — I received this">
                          <ActionIcon variant="subtle" color="green" onClick={() => onConfirm(earning.id)}>
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancel — this never arrived">
                          <ActionIcon variant="subtle" color="orange" onClick={() => onCancel(earning.id)}>
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip label="Edit">
                      <ActionIcon variant="subtle" onClick={() => onEdit(earning)}>
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete — this occurrence will not come back">
                      <ActionIcon variant="subtle" color="red" onClick={() => onDelete(earning)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
