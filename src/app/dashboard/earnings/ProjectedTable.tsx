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
import type { ProjectedOccurrenceView } from "@/types/earning";

interface ProjectedTableProps {
  occurrences: ProjectedOccurrenceView[];
  onSkip: (occurrence: ProjectedOccurrenceView) => void;
  onClearException: (occurrence: ProjectedOccurrenceView) => void;
  onOverride: (
    occurrence: ProjectedOccurrenceView,
    values: Record<string, unknown>
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Future occurrences. These are computed from the rule on every request and never stored, which
 * is why they carry no id and cannot be allocated to a bucket — they become real rows only once
 * their date passes.
 */
export default function ProjectedTable({ occurrences, onSkip, onClearException, onOverride }: ProjectedTableProps) {
  const [editing, setEditing] = useState<ProjectedOccurrenceView | null>(null);
  const [overrideDate, setOverrideDate] = useState<string | null>(null);
  const [overrideGross, setOverrideGross] = useState<string | number>("");
  const [overrideNet, setOverrideNet] = useState<string | number>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setOverrideDate(toDateInputValue(editing.date));
    setOverrideGross(editing.grossAmount);
    setOverrideNet(editing.netAmount);
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
        overrideGross: overrideGross === "" ? null : toNumber(overrideGross),
        overrideNet: overrideNet === "" ? null : toNumber(overrideNet),
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

  const currencyIcon = <IconCurrencyDollar size={20} stroke={1.5} />;

  if (!occurrences.length) {
    return (
      <Text c="dimmed" size="sm">
        Nothing projected in this window. Add an active income rule to see upcoming pay dates.
      </Text>
    );
  }

  return (
    <>
      <Table.ScrollContainer minWidth={640}>
        <Table highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Expected</Table.Th>
              <Table.Th>Rule</Table.Th>
              <Table.Th ta="right">Gross</Table.Th>
              <Table.Th ta="right">Net</Table.Th>
              <Table.Th />
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {occurrences.map((occurrence) => {
              const key = `${occurrence.ruleId}:${new Date(occurrence.scheduledDate).toISOString()}`;
              return (
                <Table.Tr key={key} opacity={occurrence.skipped ? 0.5 : 1}>
                  <Table.Td>
                    <Text size="sm" td={occurrence.skipped ? "line-through" : undefined}>
                      {formatDay(occurrence.date)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{occurrence.ruleTitle}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(occurrence.grossAmount)}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(occurrence.netAmount)}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {occurrence.skipped && (
                        <Badge color="gray" variant="light">
                          Skipped
                        </Badge>
                      )}
                      {occurrence.overridden && (
                        <Badge color="blue" variant="light">
                          Changed
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Change this one occurrence">
                        <ActionIcon variant="subtle" onClick={() => setEditing(occurrence)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {occurrence.skipped || occurrence.overridden ? (
                        <Tooltip label="Restore what the rule says">
                          <ActionIcon variant="subtle" color="gray" onClick={() => onClearException(occurrence)}>
                            <IconArrowBackUp size={16} />
                          </ActionIcon>
                        </Tooltip>
                      ) : (
                        <Tooltip label="Skip this one occurrence">
                          <ActionIcon variant="subtle" color="orange" onClick={() => onSkip(occurrence)}>
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
        title="Change this occurrence"
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      >
        <form onSubmit={submitOverride}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            <Text size="sm" c="dimmed">
              Applies to this one pay date only. The rule itself is unchanged.
            </Text>
            <DatePickerInput
              label="Date"
              value={overrideDate}
              onChange={setOverrideDate}
              firstDayOfWeek={0}
              highlightToday
            />
            <Group grow>
              <NumberInput
                label="Gross"
                leftSection={currencyIcon}
                value={overrideGross}
                onChange={setOverrideGross}
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                hideControls
              />
              <NumberInput
                label="Net"
                leftSection={currencyIcon}
                value={overrideNet}
                onChange={setOverrideNet}
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                hideControls
              />
            </Group>
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
