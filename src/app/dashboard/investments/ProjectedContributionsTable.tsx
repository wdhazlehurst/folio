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
import type { ProjectedContributionView } from "@/types/investment";

interface ProjectedContributionsTableProps {
  contributions: ProjectedContributionView[];
  onSkip: (contribution: ProjectedContributionView) => void;
  onClearException: (contribution: ProjectedContributionView) => void;
  onOverride: (
    contribution: ProjectedContributionView,
    values: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Upcoming contributions. Computed from the account on every request and never stored, which is
 * why they carry no id — they become real rows, moving the balance, only once their date passes.
 *
 * "Balance after" adds up contributions alone. No rate of return is applied: assumed growth is a
 * Long term goal, and compounding one in here would dress a schedule up as a forecast.
 */
export default function ProjectedContributionsTable({
  contributions,
  onSkip,
  onClearException,
  onOverride,
}: ProjectedContributionsTableProps) {
  const [editing, setEditing] = useState<ProjectedContributionView | null>(null);
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

  if (!contributions.length) {
    return (
      <Text c="dimmed" size="sm">
        Nothing scheduled in this window. Give an active account a contribution amount to see what is coming.
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
              <Table.Th>Account</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              <Table.Th ta="right">Balance after</Table.Th>
              <Table.Th />
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contributions.map((contribution) => {
              const key = `${contribution.investmentId}:${new Date(contribution.scheduledDate).toISOString()}`;
              return (
                <Table.Tr key={key} opacity={contribution.skipped ? 0.5 : 1}>
                  <Table.Td>
                    <Text size="sm" td={contribution.skipped ? "line-through" : undefined}>
                      {formatDay(contribution.date)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{contribution.investmentTitle}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(contribution.amount)}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(contribution.balanceAfter)}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {contribution.skipped && (
                        <Badge color="gray" variant="light">
                          Skipped
                        </Badge>
                      )}
                      {contribution.overridden && (
                        <Badge color="blue" variant="light">
                          Changed
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Change this one contribution">
                        <ActionIcon variant="subtle" onClick={() => setEditing(contribution)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {contribution.skipped || contribution.overridden ? (
                        <Tooltip label="Restore what the schedule says">
                          <ActionIcon variant="subtle" color="gray" onClick={() => onClearException(contribution)}>
                            <IconArrowBackUp size={16} />
                          </ActionIcon>
                        </Tooltip>
                      ) : (
                        <Tooltip label="Skip this one contribution">
                          <ActionIcon variant="subtle" color="orange" onClick={() => onSkip(contribution)}>
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
        title="Change this contribution"
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      >
        <form onSubmit={submitOverride}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            <Text size="sm" c="dimmed">
              Applies to this one date only. The account itself is unchanged.
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
