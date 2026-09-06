"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import {
  cancelContribution,
  clearContributionException,
  confirmAllPendingContributions,
  confirmContribution,
  createInvestment,
  deleteContribution,
  deleteContributionLimit,
  deleteInvestment,
  getContributionLimits,
  getContributionUsage,
  getContributions,
  getInvestmentSummary,
  getInvestments,
  getProjectedContributions,
  materializeDueContributions,
  recordContribution,
  recordInvestmentBalance,
  recordRollover,
  recordWithdrawal,
  saveContributionLimit,
  setContributionException,
  setInvestmentActive,
  updateContribution,
  updateInvestment,
} from "./actions";
import ContributionLimitsCard from "./ContributionLimitsCard";
import ContributionsTable from "./ContributionsTable";
import InvestmentForm from "./InvestmentForm";
import ProjectedContributionsTable from "./ProjectedContributionsTable";
import RecordBalanceForm from "./RecordBalanceForm";
import RecordContributionForm from "./RecordContributionForm";
import { getBucketOptions } from "../budget/actions";
import { getUserExpenseCategories } from "../expenses/categories/actions";
import { formatCurrency, formatDay } from "@/lib/format";
import { FREQUENCY_LABELS } from "@/lib/recurrence";
import {
  ACCOUNT_TYPE_LABELS,
  type ContributionLimitView,
  type ContributionUsage,
  type ContributionView,
  type InvestmentSummary,
  type InvestmentView,
  type ProjectedContributionView,
} from "@/types/investment";

const EMPTY_SUMMARY: InvestmentSummary = {
  totalBalance: 0,
  monthlyContribution: 0,
  accountCount: 0,
  byType: [],
};

export default function InvestmentsPage() {
  // Limits are per calendar year, and the page always shows the year you are actually in. Held in
  // state so its identity is stable: recomputing it each render would change `refreshData`, which
  // the load effect depends on, and the page would refetch in a loop.
  const [currentYear] = useState(() => new Date().getUTCFullYear());

  const [investments, setInvestments] = useState<InvestmentView[]>([]);
  const [contributions, setContributions] = useState<ContributionView[]>([]);
  const [projected, setProjected] = useState<ProjectedContributionView[]>([]);
  const [summary, setSummary] = useState<InvestmentSummary>(EMPTY_SUMMARY);
  const [usage, setUsage] = useState<ContributionUsage[]>([]);
  const [limits, setLimits] = useState<ContributionLimitView[]>([]);
  const [bucketOptions, setBucketOptions] = useState<{ value: string; label: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [investmentModalOpen, setInvestmentModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<InvestmentView | null>(null);
  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [targetInvestmentId, setTargetInvestmentId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [
        investmentsData,
        contributionsData,
        projectedData,
        summaryData,
        usageData,
        limitsData,
        buckets,
        categories,
      ] = await Promise.all([
        getInvestments(),
        getContributions(),
        getProjectedContributions(),
        getInvestmentSummary(),
        getContributionUsage(currentYear),
        getContributionLimits(currentYear),
        getBucketOptions(),
        getUserExpenseCategories(),
      ]);
      setInvestments(investmentsData);
      setContributions(contributionsData);
      setProjected(projectedData);
      setSummary(summaryData);
      setUsage(usageData);
      setLimits(limitsData);
      setBucketOptions(buckets);
      setCategoryOptions(categories.map((category) => ({ value: category.id ?? "", label: category.title })));
    } catch (err) {
      setError("Failed to load investment data");
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, [currentYear]);

  // Auto-post first, then load — the same "auto-post, then verify" flow the earnings and debts
  // pages use. Any contribution whose date has passed becomes a real row, raising the balance,
  // and waits for confirmation before the page renders it.
  useEffect(() => {
    (async () => {
      await materializeDueContributions();
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

  const pending = contributions.filter((contribution) => contribution.status === "PROJECTED");

  const handleInvestmentSubmit = async (values: Record<string, unknown>, id?: string) => {
    const response = id ? await updateInvestment({ ...values, id }) : await createInvestment(values);
    if (response.ok) {
      // A new or edited account changes what is due, so post immediately rather than next visit.
      await materializeDueContributions();
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  /** One modal, three kinds — the action taken depends on which was chosen. */
  const handleRecordMovement = async (values: Record<string, unknown>) => {
    const { kind, ...rest } = values;
    const response =
      kind === "WITHDRAWAL"
        ? await recordWithdrawal(rest)
        : kind === "ROLLOVER"
          ? await recordRollover(rest)
          : await recordContribution(rest);
    if (response.ok) {
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleEditContribution = async (_contribution: ContributionView, values: Record<string, unknown>) => {
    const response = await updateContribution(values);
    if (response.ok) {
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleSaveLimit = async (values: Record<string, unknown>) => {
    const response = await saveContributionLimit(values);
    if (response.ok) {
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleDeleteLimit = (limit: ContributionLimitView) => {
    if (!window.confirm("Remove this limit? Contribution room will show as not set until you enter one again.")) return;
    run(() => deleteContributionLimit(limit.id));
  };

  const handleRecordBalance = async (values: Record<string, unknown>) => {
    const response = await recordInvestmentBalance(values);
    if (response.ok) {
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleDeleteInvestment = (investment: InvestmentView) => {
    const message =
      `Delete "${investment.title}"? Contributions already made are kept, ` +
      "but this account's balance history is removed.";
    if (!window.confirm(message)) return;
    run(() => deleteInvestment(investment.id));
  };

  const handleCancelContribution = (contribution: ContributionView) => {
    const expense = contribution.expenseId ? " and the expense it created is removed" : "";
    if (
      !window.confirm(
        `Cancel this ${formatCurrency(contribution.amount)} contribution? The balance goes back down${expense}.`
      )
    )
      return;
    run(() => cancelContribution(contribution.id));
  };

  const handleDeleteContribution = (contribution: ContributionView) => {
    const reversal = contribution.status === "CANCELLED" ? "" : " The balance goes back down.";
    const scheduled = contribution.scheduledDate
      ? " This slot will be skipped permanently and will not post again."
      : "";
    if (!window.confirm(`Delete this ${formatCurrency(contribution.amount)} contribution?${reversal}${scheduled}`))
      return;
    run(() => deleteContribution(contribution.id));
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Investments</Title>
          <Text size="xs" c="dimmed">
            {summary.accountCount === 0
              ? "Nothing tracked yet"
              : `${formatCurrency(summary.totalBalance)} across ${summary.accountCount} account${
                  summary.accountCount === 1 ? "" : "s"
                } · ${formatCurrency(summary.monthlyContribution)} a month going in`}
          </Text>
        </div>
        <Group gap="xs">
          <Button
            variant="default"
            disabled={!investments.length}
            onClick={() => {
              setTargetInvestmentId(null);
              setBalanceModalOpen(true);
            }}
          >
            Update balance
          </Button>
          <Button
            variant="default"
            disabled={!investments.length}
            onClick={() => {
              setTargetInvestmentId(null);
              setContributionModalOpen(true);
            }}
          >
            Record money in or out
          </Button>
          <Button
            onClick={() => {
              setEditingInvestment(null);
              setInvestmentModalOpen(true);
            }}
          >
            New account
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {pending.length > 0 && (
        <Alert color="yellow" title={`${pending.length} contribution${pending.length === 1 ? "" : "s"} to verify`}>
          <Group justify="space-between" align="center">
            <Text size="sm">
              These posted automatically when their date passed, raising each account&apos;s balance. Confirm the ones
              that went in; cancel any that did not, which puts the balance back.
            </Text>
            <Button size="xs" onClick={() => run(() => confirmAllPendingContributions())}>
              Confirm all
            </Button>
          </Group>
        </Alert>
      )}

      {dataLoading ? (
        <Stack gap="xs">
          <Skeleton height={140} />
          <Skeleton height={32} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </Stack>
      ) : (
        <>
          {investments.length === 0 ? (
            <Card withBorder padding="md">
              <Text c="dimmed" size="sm">
                No accounts yet. Add an HSA, IRA, 401(k) or savings account with its balance, and any recurring
                contribution will post automatically once its date passes.
              </Text>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {investments.map((investment) => (
                <Card key={investment.id} withBorder padding="md">
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <div>
                        <Group gap="xs" align="center">
                          <Text fw={600}>{investment.title}</Text>
                          {!investment.isActive && (
                            <Badge color="gray" variant="light">
                              Paused
                            </Badge>
                          )}
                          {investment.belowMatchThreshold && (
                            <Tooltip
                              label={`Contribute ${formatCurrency(
                                investment.contributionForFullMatch ?? 0
                              )} across the year to collect the full ${formatCurrency(
                                investment.maxAnnualMatch ?? 0
                              )} match. You are on track for less.`}
                            >
                              <Badge color="orange" variant="light">
                                Missing match
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {ACCOUNT_TYPE_LABELS[investment.accountType]}
                          {investment.institution ? ` · ${investment.institution}` : ""}
                        </Text>
                      </div>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Record a contribution to this account">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => {
                              setTargetInvestmentId(investment.id);
                              setContributionModalOpen(true);
                            }}
                          >
                            <IconPlus size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit account">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => {
                              setEditingInvestment(investment);
                              setInvestmentModalOpen(true);
                            }}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete account">
                          <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteInvestment(investment)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>

                    <Text size="xl" fw={700}>
                      {formatCurrency(investment.balance)}
                    </Text>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Contribution
                      </Text>
                      <Text size="sm">
                        {investment.contributionAmount > 0
                          ? `${formatCurrency(investment.contributionAmount)} · ${FREQUENCY_LABELS[
                              investment.frequency
                            ].toLowerCase()}`
                          : "Balance only"}
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Next
                      </Text>
                      <Text size="sm">
                        {investment.nextContributionDate
                          ? `${formatDay(investment.nextContributionDate)} · ${formatCurrency(
                              investment.nextContributionAmount ?? 0
                            )}`
                          : "—"}
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Funded from
                      </Text>
                      <Tooltip
                        label={
                          investment.fundedFromAccount
                            ? "Each contribution records an expense in this bucket"
                            : "Nothing leaves your account — no expense is recorded"
                        }
                      >
                        <Text size="sm" c={investment.fundedFromAccount ? undefined : "dimmed"}>
                          {investment.fundedFromAccount ? (investment.bucketTitle ?? "Your account") : "Pre-tax"}
                        </Text>
                      </Tooltip>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        In this year
                      </Text>
                      <Text size="sm">
                        {formatCurrency(investment.employeeContributedThisYear)}
                        {investment.employerContributedThisYear > 0
                          ? ` + ${formatCurrency(investment.employerContributedThisYear)} employer`
                          : ""}
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Balance as of
                      </Text>
                      <Text size="sm" c={investment.lastSnapshotDate ? undefined : "dimmed"}>
                        {investment.lastSnapshotDate ? formatDay(investment.lastSnapshotDate) : "—"}
                      </Text>
                    </Group>

                    <Switch
                      mt="xs"
                      size="sm"
                      label="Active"
                      checked={investment.isActive}
                      onChange={(e) => run(() => setInvestmentActive(investment.id, e.currentTarget.checked))}
                    />
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}

          {summary.byType.length > 1 && (
            <Card withBorder padding="md">
              <Group gap="lg">
                {summary.byType.map((slice) => (
                  <div key={slice.accountType}>
                    <Text size="xs" c="dimmed">
                      {slice.label}
                    </Text>
                    <Text fw={600}>{formatCurrency(slice.balance)}</Text>
                  </div>
                ))}
              </Group>
            </Card>
          )}

          <ContributionLimitsCard
            year={currentYear}
            usage={usage}
            limits={limits}
            onSave={handleSaveLimit}
            onDelete={handleDeleteLimit}
          />

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={600}>Contributions</Text>
              <ContributionsTable
                contributions={contributions}
                onConfirm={(id) => run(() => confirmContribution(id))}
                onCancel={handleCancelContribution}
                onDelete={handleDeleteContribution}
                onEdit={handleEditContribution}
              />
            </Stack>
          </Card>

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Group gap="xs" align="baseline">
                <Text fw={600}>Upcoming</Text>
                <Text size="xs" c="dimmed">
                  projected — contributions only, with no assumed rate of return
                </Text>
              </Group>
              <ProjectedContributionsTable
                contributions={projected}
                onSkip={(contribution) =>
                  run(() =>
                    setContributionException({
                      investmentId: contribution.investmentId,
                      scheduledDate: contribution.scheduledDate,
                      action: "SKIP",
                    })
                  )
                }
                onClearException={(contribution) =>
                  run(() => clearContributionException(contribution.investmentId, contribution.scheduledDate))
                }
                onOverride={(contribution, values) =>
                  run(() =>
                    setContributionException({
                      investmentId: contribution.investmentId,
                      scheduledDate: contribution.scheduledDate,
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

      <InvestmentForm
        opened={investmentModalOpen}
        onClose={() => setInvestmentModalOpen(false)}
        investment={editingInvestment}
        bucketOptions={bucketOptions}
        categoryOptions={categoryOptions}
        onSubmit={handleInvestmentSubmit}
      />
      <RecordContributionForm
        opened={contributionModalOpen}
        onClose={() => setContributionModalOpen(false)}
        investments={investments}
        defaultInvestmentId={targetInvestmentId}
        onSubmit={handleRecordMovement}
      />
      <RecordBalanceForm
        opened={balanceModalOpen}
        onClose={() => setBalanceModalOpen(false)}
        investments={investments}
        defaultInvestmentId={targetInvestmentId}
        onSubmit={handleRecordBalance}
      />
    </Stack>
  );
}
