"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import {
  cancelEarning,
  clearOccurrenceException,
  confirmAllPending,
  confirmEarning,
  createEarning,
  createEarningRule,
  deleteEarning,
  deleteEarningRule,
  getEarningRules,
  getEarnings,
  getIncomeAverages,
  getProjectedOccurrences,
  materializeDueEarnings,
  setEarningRuleActive,
  setOccurrenceException,
  updateEarning,
  updateEarningRule,
} from "./actions";
import EarningForm from "./EarningForm";
import EarningRuleForm from "./EarningRuleForm";
import EarningsTable from "./EarningsTable";
import IncomeAverages from "./IncomeAverages";
import ProjectedTable from "./ProjectedTable";
import { formatCurrency, formatDay } from "@/lib/format";
import type { EarningRuleView, EarningView, IncomeAverage, ProjectedOccurrenceView } from "@/types/earning";

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  SEMI_MONTHLY: "Twice a month",
  MONTHLY: "Monthly",
};

export default function EarningsPage() {
  const [rules, setRules] = useState<EarningRuleView[]>([]);
  const [earnings, setEarnings] = useState<EarningView[]>([]);
  const [projected, setProjected] = useState<ProjectedOccurrenceView[]>([]);
  const [averages, setAverages] = useState<IncomeAverage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EarningRuleView | null>(null);
  const [earningModalOpen, setEarningModalOpen] = useState(false);
  const [editingEarning, setEditingEarning] = useState<EarningView | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [rulesData, earningsData, projectedData, averagesData] = await Promise.all([
        getEarningRules(),
        getEarnings(),
        getProjectedOccurrences(),
        getIncomeAverages(),
      ]);
      setRules(rulesData);
      setEarnings(earningsData);
      setProjected(projectedData);
      setAverages(averagesData);
    } catch (err) {
      setError("Failed to load income data");
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Auto-post first, then load. This is the "auto-post, then verify" flow: anything whose date
  // has passed becomes a real row awaiting confirmation before the page renders it.
  useEffect(() => {
    (async () => {
      await materializeDueEarnings();
      await refreshData();
    })();
  }, [refreshData]);

  /** Runs a mutation, surfaces its error, and refreshes on success. */
  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const response = await action();
    if (!response.ok) {
      setError(response.error ?? "Something went wrong");
      return response;
    }
    await refreshData();
    return response;
  };

  const pending = earnings.filter((earning) => earning.status === "PROJECTED");

  const handleRuleSubmit = async (values: Record<string, unknown>, id?: string) => {
    const response = id ? await updateEarningRule(id, values) : await createEarningRule(values);
    if (response.ok) {
      // A new or edited rule changes what is due, so post immediately rather than next visit.
      await materializeDueEarnings();
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleEarningSubmit = async (values: Record<string, unknown>, id?: string) => {
    const response = id ? await updateEarning({ ...values, id }) : await createEarning(values);
    if (response.ok) {
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleDeleteEarning = (earning: EarningView) => {
    const fromRule = earning.ruleId !== null;
    const message = fromRule
      ? `Delete this occurrence of "${earning.title}"? It will be skipped permanently and will not post again.`
      : `Delete "${earning.title}"?`;
    if (!window.confirm(message)) return;
    run(() => deleteEarning(earning.id));
  };

  const handleDeleteRule = (rule: EarningRuleView) => {
    if (!window.confirm(`Delete the rule "${rule.title}"? Income it already posted is kept.`)) return;
    run(() => deleteEarningRule(rule.id));
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>Earnings</Title>
        <Group gap="xs">
          <Button
            variant="default"
            onClick={() => {
              setEditingEarning(null);
              setEarningModalOpen(true);
            }}
          >
            Add earning
          </Button>
          <Button
            onClick={() => {
              setEditingRule(null);
              setRuleModalOpen(true);
            }}
          >
            New income rule
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {pending.length > 0 && (
        <Alert color="yellow" title={`${pending.length} posting${pending.length === 1 ? "" : "s"} to verify`}>
          <Group justify="space-between" align="center">
            <Text size="sm">
              These posted automatically when their date passed. Confirm the ones you received; cancel any that did not
              arrive. Only confirmed income can fund a budget bucket.
            </Text>
            <Button size="xs" onClick={() => run(() => confirmAllPending())}>
              Confirm all
            </Button>
          </Group>
        </Alert>
      )}

      {dataLoading ? (
        <Stack gap="xs">
          <Skeleton height={120} />
          <Skeleton height={32} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </Stack>
      ) : (
        <>
          <IncomeAverages averages={averages} />

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={600}>Income rules</Text>
              {rules.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No rules yet. A rule generates pay dates going forward; each one posts as a real entry once its date
                  passes.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={640}>
                  <Table verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Frequency</Table.Th>
                        <Table.Th>First pay date</Table.Th>
                        <Table.Th ta="right">Gross</Table.Th>
                        <Table.Th ta="right">Net</Table.Th>
                        <Table.Th>Active</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rules.map((rule) => (
                        <Table.Tr key={rule.id}>
                          <Table.Td>
                            <Group gap="xs">
                              <Text size="sm">{rule.title}</Text>
                              {rule.endDate && (
                                <Badge size="xs" variant="light" color="gray">
                                  ends {formatDay(rule.endDate)}
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>{FREQUENCY_LABELS[rule.frequency] ?? rule.frequency}</Table.Td>
                          <Table.Td>{formatDay(rule.anchorDate)}</Table.Td>
                          <Table.Td ta="right">{formatCurrency(rule.grossAmount)}</Table.Td>
                          <Table.Td ta="right">{formatCurrency(rule.netAmount)}</Table.Td>
                          <Table.Td>
                            <Switch
                              size="sm"
                              checked={rule.isActive}
                              onChange={(e) => run(() => setEarningRuleActive(rule.id, e.currentTarget.checked))}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} justify="flex-end" wrap="nowrap">
                              <Tooltip label="Edit rule">
                                <ActionIcon
                                  variant="subtle"
                                  onClick={() => {
                                    setEditingRule(rule);
                                    setRuleModalOpen(true);
                                  }}
                                >
                                  <IconPencil size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Delete rule">
                                <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteRule(rule)}>
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          </Card>

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={600}>Received</Text>
              <EarningsTable
                earnings={earnings}
                onConfirm={(id) => run(() => confirmEarning(id))}
                onCancel={(id) => run(() => cancelEarning(id))}
                onEdit={(earning) => {
                  setEditingEarning(earning);
                  setEarningModalOpen(true);
                }}
                onDelete={handleDeleteEarning}
              />
            </Stack>
          </Card>

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Group gap="xs" align="baseline">
                <Text fw={600}>Upcoming</Text>
                <Text size="xs" c="dimmed">
                  projected — not yet real entries, and not available to allocate
                </Text>
              </Group>
              <ProjectedTable
                occurrences={projected}
                onSkip={(occurrence) =>
                  run(() =>
                    setOccurrenceException({
                      ruleId: occurrence.ruleId,
                      scheduledDate: occurrence.scheduledDate,
                      action: "SKIP",
                    })
                  )
                }
                onClearException={(occurrence) =>
                  run(() => clearOccurrenceException(occurrence.ruleId, occurrence.scheduledDate))
                }
                onOverride={(occurrence, values) =>
                  run(() =>
                    setOccurrenceException({
                      ruleId: occurrence.ruleId,
                      scheduledDate: occurrence.scheduledDate,
                      action: "OVERRIDE",
                      ...values,
                    })
                  )
                }
              />
            </Stack>
          </Card>
        </>
      )}

      <EarningRuleForm
        opened={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        rule={editingRule}
        onSubmit={handleRuleSubmit}
      />
      <EarningForm
        opened={earningModalOpen}
        onClose={() => setEarningModalOpen(false)}
        earning={editingEarning}
        onSubmit={handleEarningSubmit}
      />
    </Stack>
  );
}
