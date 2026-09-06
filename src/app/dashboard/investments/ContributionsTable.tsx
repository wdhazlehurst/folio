"use client";

import { useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCheck, IconCurrencyDollar, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { formatCurrency, formatDay, toDateInputValue } from "@/lib/format";
import type { ContributionView } from "@/types/investment";

/** What each kind is, in the table. Employer money and rollovers are not your contributions. */
const KIND_STYLE = {
  EMPLOYEE: { color: "blue", label: "Contribution", counts: true },
  EMPLOYER_MATCH: { color: "grape", label: "Employer match", counts: false },
  ROLLOVER: { color: "cyan", label: "Rollover in", counts: false },
  WITHDRAWAL: { color: "orange", label: "Withdrawal", counts: false },
} as const;

const STATUS_STYLE = {
  PROJECTED: { color: "yellow", label: "Awaiting confirmation" },
  CONFIRMED: { color: "green", label: "Confirmed" },
  CANCELLED: { color: "gray", label: "Cancelled" },
} as const;

interface ContributionsTableProps {
  contributions: ContributionView[];
  onConfirm: (id: string) => void;
  onCancel: (contribution: ContributionView) => void;
  onDelete: (contribution: ContributionView) => void;
  /** Manual override: correct what a posted contribution actually was. */
  onEdit: (contribution: ContributionView, values: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Posted contributions. Each one already moved the balance when it posted, so confirming changes
 * only the status — it is cancelling that reverses it.
 *
 * "Recorded as an expense" reflects whether the account has a bucket or category: contributions
 * that leave the checking account write an expense, a pre-tax deferral does not.
 */
export default function ContributionsTable({
  contributions,
  onConfirm,
  onCancel,
  onDelete,
  onEdit,
}: ContributionsTableProps) {
  const [editing, setEditing] = useState<ContributionView | null>(null);
  const [amount, setAmount] = useState<string | number>("");
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setAmount(editing.amount);
    setDate(toDateInputValue(editing.date));
    setError(null);
  }, [editing]);

  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await onEdit(editing, {
        id: editing.id,
        amount: amount === "" ? 0 : toNumber(amount),
        date: date ? new Date(date) : editing.date,
      });
      if (!response.ok) {
        setError(response.error ?? "Something went wrong");
        return;
      }
      setEditing(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!contributions.length) {
    return (
      <Text c="dimmed" size="sm">
        No contributions yet. An account posts one here once its contribution date passes, or record one by hand.
      </Text>
    );
  }

  return (
    <>
      <Table.ScrollContainer minWidth={780}>
        <Table striped highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contributions.map((contribution) => {
              const status = STATUS_STYLE[contribution.status];
              return (
                <Table.Tr key={contribution.id}>
                  <Table.Td>{formatDay(contribution.date)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c={contribution.investmentTitle ? undefined : "dimmed"}>
                      {contribution.investmentTitle ?? "Deleted account"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={KIND_STYLE[contribution.kind].color} variant="light">
                      {KIND_STYLE[contribution.kind].label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {contribution.scheduledDate ? "Scheduled" : "Recorded by hand"}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c={contribution.kind === "WITHDRAWAL" ? "orange" : undefined}>
                      {contribution.kind === "WITHDRAWAL" ? "−" : ""}
                      {formatCurrency(contribution.amount)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Badge color={status.color} variant="light">
                        {status.label}
                      </Badge>
                      {contribution.expenseId && (
                        <Tooltip label="This contribution also recorded an expense">
                          <Badge color="blue" variant="light">
                            Expensed
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      {contribution.status === "PROJECTED" && (
                        <>
                          <Tooltip label="Confirm — this contribution went in">
                            <ActionIcon variant="subtle" color="green" onClick={() => onConfirm(contribution.id)}>
                              <IconCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Cancel — this contribution never happened">
                            <ActionIcon variant="subtle" color="orange" onClick={() => onCancel(contribution)}>
                              <IconX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                      {contribution.status !== "CANCELLED" && (
                        <Tooltip label="Correct what this actually was">
                          <ActionIcon variant="subtle" onClick={() => setEditing(contribution)}>
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Tooltip label="Delete — this contribution will not post again">
                        <ActionIcon variant="subtle" color="red" onClick={() => onDelete(contribution)}>
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

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title="Correct this entry"
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      >
        <form onSubmit={submitEdit}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            <Text size="sm" c="dimmed">
              For when the real figure turned out to be different. The account balance and any expense this created are
              adjusted by the difference. Employer match is not recalculated — correct that entry directly if it also
              changed.
            </Text>
            <NumberInput
              label="Amount"
              leftSection={<IconCurrencyDollar size={20} stroke={1.5} />}
              value={amount}
              onChange={setAmount}
              required
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
            />
            <DatePickerInput label="Date" value={date} onChange={setDate} required firstDayOfWeek={0} highlightToday />
            <Group justify="flex-end" mt="xs">
              <Button type="submit" loading={submitting} disabled={submitting}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
