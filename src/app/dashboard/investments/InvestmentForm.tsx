"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCurrencyDollar, IconPercentage } from "@tabler/icons-react";
import { FREQUENCY_LABELS } from "@/lib/recurrence";
import { toDateInputValue } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER, type InvestmentView } from "@/types/investment";
import { formatCurrency } from "@/lib/format";
import { matchPlanFor } from "@/lib/contribution-limits";

interface InvestmentFormProps {
  opened: boolean;
  onClose: () => void;
  /** Present when editing an existing account; absent when creating one. */
  investment?: InvestmentView | null;
  bucketOptions: { value: string; label: string }[];
  categoryOptions: { value: string; label: string }[];
  onSubmit: (values: Record<string, unknown>, id?: string) => Promise<{ ok: boolean; error?: string }>;
}

const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPE_ORDER.map((type) => ({ value: type, label: ACCOUNT_TYPE_LABELS[type] }));

const FREQUENCY_OPTIONS = (["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"] as const).map((frequency) => ({
  value: frequency,
  label: FREQUENCY_LABELS[frequency],
}));

export default function InvestmentForm({
  opened,
  onClose,
  investment,
  bucketOptions,
  categoryOptions,
  onSubmit,
}: InvestmentFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accountType, setAccountType] = useState<string | null>("SAVINGS");
  const [institution, setInstitution] = useState("");
  const [balance, setBalance] = useState<string | number>("");
  const [contributionAmount, setContributionAmount] = useState<string | number>("");
  const [frequency, setFrequency] = useState<string | null>("MONTHLY");
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [secondDayOfMonth, setSecondDayOfMonth] = useState<string | number>("");
  const [endDate, setEndDate] = useState<string | null>(null);
  const [bucketId, setBucketId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [assumedReturnRate, setAssumedReturnRate] = useState<string | number>("");
  const [hsaCoverage, setHsaCoverage] = useState<string | null>(null);
  const [employerMatchPercent, setEmployerMatchPercent] = useState<string | number>("");
  const [employerMatchLimitPercent, setEmployerMatchLimitPercent] = useState<string | number>("");
  const [annualSalary, setAnnualSalary] = useState<string | number>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reload the fields whenever the modal opens, so editing one account then another never shows
  // the previous account's values.
  useEffect(() => {
    if (!opened) return;
    setTitle(investment?.title ?? "");
    setDescription(investment?.description ?? "");
    setAccountType(investment?.accountType ?? "SAVINGS");
    setInstitution(investment?.institution ?? "");
    setBalance(investment?.balance ?? "");
    setContributionAmount(investment?.contributionAmount ?? "");
    setFrequency(investment?.frequency ?? "MONTHLY");
    setAnchorDate(toDateInputValue(investment?.anchorDate) ?? toDateInputValue(new Date()));
    setSecondDayOfMonth(investment?.secondDayOfMonth ?? "");
    setEndDate(toDateInputValue(investment?.endDate));
    setBucketId(investment?.bucketId ?? null);
    setCategoryId(investment?.categoryId ?? null);
    setIsActive(investment?.isActive ?? true);
    setAssumedReturnRate(investment?.assumedReturnRate ?? "");
    setHsaCoverage(investment?.hsaCoverage ?? null);
    setEmployerMatchPercent(investment?.employerMatchPercent ?? "");
    setEmployerMatchLimitPercent(investment?.employerMatchLimitPercent ?? "");
    setAnnualSalary(investment?.annualSalary ?? "");
    setError(null);
  }, [opened, investment]);

  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title || balance === "" || !accountType || !frequency) {
      setError("Missing required field(s)");
      return;
    }
    if (!anchorDate) {
      setError("A first contribution date is required");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onSubmit(
        {
          title,
          description: description.trim() || undefined,
          accountType,
          institution: institution.trim() || undefined,
          balance: toNumber(balance),
          contributionAmount: contributionAmount === "" ? 0 : toNumber(contributionAmount),
          frequency,
          // `anchorDate` is `YYYY-MM-DD`, which `new Date` parses as UTC midnight — the shape a
          // @db.Date column wants.
          anchorDate: new Date(anchorDate),
          secondDayOfMonth: secondDayOfMonth === "" ? null : toNumber(secondDayOfMonth),
          endDate: endDate ? new Date(endDate) : null,
          bucketId,
          categoryId,
          isActive,
          assumedReturnRate: assumedReturnRate === "" ? null : toNumber(assumedReturnRate),
          hsaCoverage,
          employerMatchPercent: employerMatchPercent === "" ? null : toNumber(employerMatchPercent),
          employerMatchLimitPercent: employerMatchLimitPercent === "" ? null : toNumber(employerMatchLimitPercent),
          annualSalary: annualSalary === "" ? null : toNumber(annualSalary),
        },
        investment?.id
      );

      if (!response.ok) {
        setError(response.error ?? "Something went wrong");
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const currencyIcon = <IconCurrencyDollar size={20} stroke={1.5} />;

  // Same pure helper the server uses to post the match, so the preview cannot disagree with it.
  const matchPreview = matchPlanFor({
    matchPercent: employerMatchPercent === "" ? null : toNumber(employerMatchPercent),
    matchLimitPercent: employerMatchLimitPercent === "" ? null : toNumber(employerMatchLimitPercent),
    annualSalary: annualSalary === "" ? null : toNumber(annualSalary),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={investment ? "Edit account" : "New account"}
      centered
      overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="Name"
            placeholder="e.g. Roth IRA"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            maxLength={32}
            data-autofocus
          />
          <Group grow>
            <Select
              label="Account type"
              data={ACCOUNT_TYPE_OPTIONS}
              value={accountType}
              onChange={setAccountType}
              required
              allowDeselect={false}
            />
            <TextInput
              label="Institution"
              placeholder="Optional — e.g. Fidelity"
              value={institution}
              onChange={(e) => setInstitution(e.currentTarget.value)}
              maxLength={64}
            />
          </Group>
          <NumberInput
            label="Current balance"
            description="What the account is worth today"
            leftSection={currencyIcon}
            value={balance}
            onChange={setBalance}
            required
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            hideControls
          />
          <Group grow>
            <NumberInput
              label="Contribution"
              description="Leave at 0 to track the balance only"
              leftSection={currencyIcon}
              value={contributionAmount}
              onChange={setContributionAmount}
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
            />
            <Select
              label="How often"
              data={FREQUENCY_OPTIONS}
              value={frequency}
              onChange={setFrequency}
              required
              allowDeselect={false}
            />
          </Group>
          <DatePickerInput
            label="First contribution date"
            description="Weekly and biweekly step from this date; monthly repeats its day"
            placeholder="Select date"
            value={anchorDate}
            onChange={setAnchorDate}
            required
            firstDayOfWeek={0}
            highlightToday
          />
          {frequency === "SEMI_MONTHLY" && (
            <NumberInput
              label="Second day of the month"
              description="The month's other contribution day; the date above supplies the first"
              value={secondDayOfMonth}
              onChange={setSecondDayOfMonth}
              min={1}
              max={31}
              allowNegative={false}
              allowDecimal={false}
            />
          )}
          <DatePickerInput
            label="Ends"
            placeholder="Optional — leave empty to keep contributing"
            value={endDate}
            onChange={setEndDate}
            clearable
            firstDayOfWeek={0}
          />
          <Select
            label="Budget bucket"
            description="Only if the money leaves your account — a pre-tax payroll deferral does not"
            placeholder="Optional — no bucket"
            data={bucketOptions}
            value={bucketId}
            onChange={setBucketId}
            clearable
            searchable
          />
          <Select
            label="Expense category"
            description="Setting a bucket or a category makes each contribution record an expense"
            placeholder="Optional — no expense recorded"
            data={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            clearable
            searchable
          />
          <NumberInput
            label="Assumed annual return"
            description="Used by projections later. A cash HSA, an index fund and a savings APY differ a lot"
            leftSection={<IconPercentage size={20} stroke={1.5} />}
            value={assumedReturnRate}
            onChange={setAssumedReturnRate}
            decimalScale={4}
            hideControls
          />
          {accountType === "HSA" && (
            <Select
              label="Health plan coverage"
              description="The family contribution limit is roughly double the self-only one"
              placeholder="Optional — treated as self-only if unset"
              data={[
                { value: "SELF_ONLY", label: "Self-only" },
                { value: "FAMILY", label: "Family" },
              ]}
              value={hsaCoverage}
              onChange={setHsaCoverage}
              clearable
            />
          )}
          {accountType === "FOUR_ZERO_ONE_K" && (
            <>
              <Group grow>
                <NumberInput
                  label="Employer match"
                  description="Percent of your contribution they add. 50 = 50c per dollar"
                  leftSection={<IconPercentage size={20} stroke={1.5} />}
                  value={employerMatchPercent}
                  onChange={setEmployerMatchPercent}
                  decimalScale={4}
                  allowNegative={false}
                  hideControls
                />
                <NumberInput
                  label="Match limit"
                  description="They match on pay up to this percent. 6 = up to 6% of pay"
                  leftSection={<IconPercentage size={20} stroke={1.5} />}
                  value={employerMatchLimitPercent}
                  onChange={setEmployerMatchLimitPercent}
                  decimalScale={4}
                  allowNegative={false}
                  max={100}
                  hideControls
                />
              </Group>
              <NumberInput
                label="Annual salary"
                description="What turns those percentages into dollars"
                leftSection={currencyIcon}
                value={annualSalary}
                onChange={setAnnualSalary}
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                hideControls
              />
              {matchPreview.configured && (
                <Alert color="blue" variant="light">
                  Put in {formatCurrency(matchPreview.employeeContributionForFullMatch)} across the year to collect the
                  full {formatCurrency(matchPreview.maxAnnualMatch)} your employer will add. Contributing less than that
                  leaves the rest unclaimed.
                </Alert>
              )}
            </>
          )}
          <Textarea
            label="Notes"
            placeholder="Optional"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={4}
            maxLength={256}
          />
          <Switch
            label="Active"
            description="A paused account stops contributing; its balance still counts toward net worth"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
          <Group justify="flex-end" mt="xs">
            <Button type="submit" loading={submitting} disabled={submitting}>
              {investment ? "Save" : "Create"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
