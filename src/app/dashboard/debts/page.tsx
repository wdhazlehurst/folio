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
  cancelDebtPayment,
  clearDebtPaymentException,
  confirmAllPendingDebtPayments,
  confirmDebtPayment,
  createDebt,
  deleteDebt,
  deleteDebtPayment,
  getDebtPayments,
  getDebtSummary,
  getDebts,
  getProjectedDebtPayments,
  materializeDueDebtPayments,
  recordDebtPayment,
  setDebtActive,
  setDebtPaymentException,
  updateDebt,
} from "./actions";
import DebtForm from "./DebtForm";
import DebtPaymentsTable from "./DebtPaymentsTable";
import ProjectedPaymentsTable from "./ProjectedPaymentsTable";
import RecordPaymentForm from "./RecordPaymentForm";
import { getBucketOptions } from "../budget/actions";
import { getUserExpenseCategories } from "../expenses/categories/actions";
import { formatCurrency, formatDay } from "@/lib/format";
import type { DebtPaymentView, DebtSummary, DebtView, ProjectedDebtPaymentView } from "@/types/debt";

const EMPTY_SUMMARY: DebtSummary = { totalBalance: 0, monthlyCommitment: 0, debtCount: 0 };

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtView[]>([]);
  const [payments, setPayments] = useState<DebtPaymentView[]>([]);
  const [projected, setProjected] = useState<ProjectedDebtPaymentView[]>([]);
  const [summary, setSummary] = useState<DebtSummary>(EMPTY_SUMMARY);
  const [bucketOptions, setBucketOptions] = useState<{ value: string; label: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtView | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [debtsData, paymentsData, projectedData, summaryData, buckets, categories] = await Promise.all([
        getDebts(),
        getDebtPayments(),
        getProjectedDebtPayments(),
        getDebtSummary(),
        getBucketOptions(),
        getUserExpenseCategories(),
      ]);
      setDebts(debtsData);
      setPayments(paymentsData);
      setProjected(projectedData);
      setSummary(summaryData);
      setBucketOptions(buckets);
      setCategoryOptions(categories.map((category) => ({ value: category.id ?? "", label: category.title })));
    } catch (err) {
      setError("Failed to load debt data");
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Auto-post first, then load. This is the same "auto-post, then verify" flow the earnings page
  // uses: any payment whose date has passed becomes a real row — decrementing the balance and
  // writing an expense — awaiting confirmation before the page renders it.
  useEffect(() => {
    (async () => {
      await materializeDueDebtPayments();
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

  const pending = payments.filter((payment) => payment.status === "PROJECTED");

  const handleDebtSubmit = async (values: Record<string, unknown>, id?: string) => {
    const response = id ? await updateDebt({ ...values, id }) : await createDebt(values);
    if (response.ok) {
      // A new or edited debt changes what is due, so post immediately rather than next visit.
      await materializeDueDebtPayments();
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleRecordPayment = async (values: Record<string, unknown>) => {
    const response = await recordDebtPayment(values);
    if (response.ok) {
      await refreshData();
      return { ok: true as const };
    }
    return response;
  };

  const handleDeleteDebt = (debt: DebtView) => {
    if (!window.confirm(`Delete "${debt.title}"? Payments already made are kept, along with their expenses.`)) return;
    run(() => deleteDebt(debt.id));
  };

  const handleCancelPayment = (payment: DebtPaymentView) => {
    const message =
      `Cancel this ${formatCurrency(payment.amount)} payment? ` +
      "The balance goes back up and the expense it created is removed.";
    if (!window.confirm(message)) return;
    run(() => cancelDebtPayment(payment.id));
  };

  const handleDeletePayment = (payment: DebtPaymentView) => {
    const reversal =
      payment.status === "CANCELLED" ? "" : " The balance goes back up and the expense it created is removed.";
    const scheduled = payment.scheduledDate ? " This slot will be skipped permanently and will not post again." : "";
    if (!window.confirm(`Delete this ${formatCurrency(payment.amount)} payment?${reversal}${scheduled}`)) return;
    run(() => deleteDebtPayment(payment.id));
  };

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Debts</Title>
          <Text size="xs" c="dimmed">
            {summary.debtCount === 0
              ? "Nothing tracked yet"
              : `${formatCurrency(summary.totalBalance)} owed across ${summary.debtCount} debt${
                  summary.debtCount === 1 ? "" : "s"
                } · ${formatCurrency(summary.monthlyCommitment)} a month`}
          </Text>
        </div>
        <Group gap="xs">
          <Button
            variant="default"
            disabled={!debts.some((debt) => !debt.paidOff)}
            onClick={() => {
              setPaymentDebtId(null);
              setPaymentModalOpen(true);
            }}
          >
            Record a payment
          </Button>
          <Button
            onClick={() => {
              setEditingDebt(null);
              setDebtModalOpen(true);
            }}
          >
            New debt
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {pending.length > 0 && (
        <Alert color="yellow" title={`${pending.length} payment${pending.length === 1 ? "" : "s"} to verify`}>
          <Group justify="space-between" align="center">
            <Text size="sm">
              These posted automatically when their date passed — each one lowered its debt&apos;s balance and recorded
              an expense. Confirm the ones you made; cancel any that did not go out, which puts the balance back and
              removes the expense.
            </Text>
            <Button size="xs" onClick={() => run(() => confirmAllPendingDebtPayments())}>
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
          {debts.length === 0 ? (
            <Card withBorder padding="md">
              <Text c="dimmed" size="sm">
                No debts yet. Add one with its balance, rate and payment, and each payment will post automatically once
                its date passes — lowering the balance and recording an expense.
              </Text>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {debts.map((debt) => (
                <Card key={debt.id} withBorder padding="md">
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <div>
                        <Group gap="xs" align="center">
                          <Text fw={600}>{debt.title}</Text>
                          {debt.paidOff && (
                            <Badge color="green" variant="light">
                              Paid off
                            </Badge>
                          )}
                          {!debt.isActive && (
                            <Badge color="gray" variant="light">
                              Paused
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {debt.interestRate}% APR · minimum {formatCurrency(debt.minimumPayment)}
                        </Text>
                      </div>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Record a payment on this debt">
                          <ActionIcon
                            variant="subtle"
                            disabled={debt.paidOff}
                            onClick={() => {
                              setPaymentDebtId(debt.id);
                              setPaymentModalOpen(true);
                            }}
                          >
                            <IconPlus size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit debt">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => {
                              setEditingDebt(debt);
                              setDebtModalOpen(true);
                            }}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete debt">
                          <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteDebt(debt)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>

                    <Text size="xl" fw={700}>
                      {formatCurrency(debt.balance)}
                    </Text>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Payment
                      </Text>
                      <Group gap={6}>
                        <Text size="sm">{formatCurrency(debt.paymentAmount)}</Text>
                        {debt.belowMinimum && (
                          <Tooltip label="This is less than the lender's minimum">
                            <Badge color="orange" variant="light">
                              Under minimum
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Next payment
                      </Text>
                      <Text size="sm">
                        {debt.nextPaymentDate
                          ? `${formatDay(debt.nextPaymentDate)} · ${formatCurrency(debt.nextPaymentAmount ?? 0)}`
                          : "—"}
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Bucket
                      </Text>
                      <Text size="sm" c={debt.bucketTitle ? undefined : "dimmed"}>
                        {debt.bucketTitle ?? "Not budgeted"}
                      </Text>
                    </Group>

                    <Switch
                      mt="xs"
                      size="sm"
                      label="Active"
                      checked={debt.isActive}
                      onChange={(e) => run(() => setDebtActive(debt.id, e.currentTarget.checked))}
                    />
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={600}>Payments</Text>
              <DebtPaymentsTable
                payments={payments}
                onConfirm={(id) => run(() => confirmDebtPayment(id))}
                onCancel={handleCancelPayment}
                onDelete={handleDeletePayment}
              />
            </Stack>
          </Card>

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Group gap="xs" align="baseline">
                <Text fw={600}>Upcoming</Text>
                <Text size="xs" c="dimmed">
                  projected — not yet real payments, and nothing has left the account
                </Text>
              </Group>
              <ProjectedPaymentsTable
                payments={projected}
                onSkip={(payment) =>
                  run(() =>
                    setDebtPaymentException({
                      debtId: payment.debtId,
                      scheduledDate: payment.scheduledDate,
                      action: "SKIP",
                    })
                  )
                }
                onClearException={(payment) =>
                  run(() => clearDebtPaymentException(payment.debtId, payment.scheduledDate))
                }
                onOverride={(payment, values) =>
                  run(() =>
                    setDebtPaymentException({
                      debtId: payment.debtId,
                      scheduledDate: payment.scheduledDate,
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

      <DebtForm
        opened={debtModalOpen}
        onClose={() => setDebtModalOpen(false)}
        debt={editingDebt}
        bucketOptions={bucketOptions}
        categoryOptions={categoryOptions}
        onSubmit={handleDebtSubmit}
      />
      <RecordPaymentForm
        opened={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        debts={debts}
        defaultDebtId={paymentDebtId}
        onSubmit={handleRecordPayment}
      />
    </Stack>
  );
}
