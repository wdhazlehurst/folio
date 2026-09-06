"use client";

import { ActionIcon, Badge, Group, Table, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconTrash, IconX } from "@tabler/icons-react";
import { formatCurrency, formatDay } from "@/lib/format";
import type { DebtPaymentView } from "@/types/debt";

const STATUS_STYLE = {
  PROJECTED: { color: "yellow", label: "Awaiting confirmation" },
  CONFIRMED: { color: "green", label: "Confirmed" },
  CANCELLED: { color: "gray", label: "Cancelled" },
} as const;

interface DebtPaymentsTableProps {
  payments: DebtPaymentView[];
  onConfirm: (id: string) => void;
  onCancel: (payment: DebtPaymentView) => void;
  onDelete: (payment: DebtPaymentView) => void;
}

/**
 * Posted payments. Each one already moved the balance and wrote an expense when it posted, so
 * confirming changes only the status — it is cancelling that reverses both.
 *
 * There is deliberately no edit action: changing a posted payment's amount is out of scope, and
 * the confirm/cancel pair is the whole verification flow.
 */
export default function DebtPaymentsTable({ payments, onConfirm, onCancel, onDelete }: DebtPaymentsTableProps) {
  if (!payments.length) {
    return (
      <Text c="dimmed" size="sm">
        No payments yet. A debt posts one here once its payment date passes, or record one by hand.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={680}>
      <Table striped highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Debt</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {payments.map((payment) => {
            const status = STATUS_STYLE[payment.status];
            return (
              <Table.Tr key={payment.id}>
                <Table.Td>{formatDay(payment.date)}</Table.Td>
                <Table.Td>
                  <Text size="sm" c={payment.debtTitle ? undefined : "dimmed"}>
                    {payment.debtTitle ?? "Deleted debt"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {payment.scheduledDate ? "Scheduled" : "Recorded by hand"}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">{formatCurrency(payment.amount)}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Badge color={status.color} variant="light">
                      {status.label}
                    </Badge>
                    {payment.status !== "CANCELLED" && !payment.expenseId && (
                      <Tooltip label="The expense this payment created has since been deleted">
                        <Badge color="orange" variant="light">
                          No expense
                        </Badge>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    {payment.status === "PROJECTED" && (
                      <>
                        <Tooltip label="Confirm — I made this payment">
                          <ActionIcon variant="subtle" color="green" onClick={() => onConfirm(payment.id)}>
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancel — this payment never went out">
                          <ActionIcon variant="subtle" color="orange" onClick={() => onCancel(payment)}>
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip label="Delete — this payment will not post again">
                      <ActionIcon variant="subtle" color="red" onClick={() => onDelete(payment)}>
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
