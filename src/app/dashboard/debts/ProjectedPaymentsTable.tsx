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
import { IconArrowBackUp, IconCurrencyDollar, IconPencil, IconPlayerSkipForward } from "@tabler/icons-react";
import { formatCurrency, formatDay, toDateInputValue } from "@/lib/format";
import type { ProjectedDebtPaymentView } from "@/types/debt";

interface ProjectedPaymentsTableProps {
  payments: ProjectedDebtPaymentView[];
  onSkip: (payment: ProjectedDebtPaymentView) => void;
  onClearException: (payment: ProjectedDebtPaymentView) => void;
  onOverride: (
    payment: ProjectedDebtPaymentView,
    values: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Upcoming payments. Computed from the debt on every request and never stored, which is why they
 * carry no id — they become real rows, moving the balance and writing an expense, only once
 * their date passes.
 *
 * Overriding one moves that single month's payment date or amount; the debt itself is unchanged.
 */
export default function ProjectedPaymentsTable({
  payments,
  onSkip,
  onClearException,
  onOverride,
}: ProjectedPaymentsTableProps) {
  const [editing, setEditing] = useState<ProjectedDebtPaymentView | null>(null);
  const [overrideDate, setOverrideDate] = useState<string | null>(null);
  const [overrideAmount, setOverrideAmount] = useState<string | number>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setOverrideDate(toDateInputValue(editing.date));
    setOverrideAmount(editing.amount);
    setError(null);
  }, [editing]);

  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const submitOverride = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await onOverride(editing, {
        overrideDate: overrideDate ? new Date(overrideDate) : null,
        overrideAmount: overrideAmount === "" ? null : toNumber(overrideAmount),
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

  if (!payments.length) {
    return (
      <Text c="dimmed" size="sm">
        Nothing scheduled in this window. Add an active debt with a balance to see upcoming payments.
      </Text>
    );
  }

  return (
    <>
      <Table.ScrollContainer minWidth={680}>
        <Table highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Due</Table.Th>
              <Table.Th>Debt</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              <Table.Th ta="right">Balance after</Table.Th>
              <Table.Th />
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {payments.map((payment) => {
              const key = `${payment.debtId}:${new Date(payment.scheduledDate).toISOString()}`;
              return (
                <Table.Tr key={key} opacity={payment.skipped ? 0.5 : 1}>
                  <Table.Td>
                    <Text size="sm" td={payment.skipped ? "line-through" : undefined}>
                      {formatDay(payment.date)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{payment.debtTitle}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(payment.amount)}</Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c={payment.balanceAfter === 0 && !payment.skipped ? "green" : undefined}>
                      {formatCurrency(payment.balanceAfter)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {payment.skipped && (
                        <Badge color="gray" variant="light">
                          Skipped
                        </Badge>
                      )}
                      {payment.overridden && (
                        <Badge color="blue" variant="light">
                          Changed
                        </Badge>
                      )}
                      {payment.balanceAfter === 0 && !payment.skipped && (
                        <Badge color="green" variant="light">
                          Pays it off
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Change this one payment">
                        <ActionIcon variant="subtle" onClick={() => setEditing(payment)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {payment.skipped || payment.overridden ? (
                        <Tooltip label="Restore what the schedule says">
                          <ActionIcon variant="subtle" color="gray" onClick={() => onClearException(payment)}>
                            <IconArrowBackUp size={16} />
                          </ActionIcon>
                        </Tooltip>
                      ) : (
                        <Tooltip label="Skip this one payment">
                          <ActionIcon variant="subtle" color="orange" onClick={() => onSkip(payment)}>
                            <IconPlayerSkipForward size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
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
        title="Change this payment"
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      >
        <form onSubmit={submitOverride}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            <Text size="sm" c="dimmed">
              Applies to this one month only. The debt itself is unchanged.
            </Text>
            <DatePickerInput
              label="Date"
              value={overrideDate}
              onChange={setOverrideDate}
              firstDayOfWeek={0}
              highlightToday
            />
            <NumberInput
              label="Amount"
              leftSection={<IconCurrencyDollar size={20} stroke={1.5} />}
              value={overrideAmount}
              onChange={setOverrideAmount}
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
            />
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
