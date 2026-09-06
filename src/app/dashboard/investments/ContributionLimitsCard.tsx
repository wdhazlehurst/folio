"use client";

import { useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Progress,
  Select,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCurrencyDollar, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { formatCurrency } from "@/lib/format";
import { LIMIT_GROUP_LABELS, LIMIT_VARIANT_LABELS } from "@/lib/contribution-limits";
import type { ContributionLimitView, ContributionUsage } from "@/types/investment";

interface ContributionLimitsCardProps {
  year: number;
  usage: ContributionUsage[];
  limits: ContributionLimitView[];
  onSave: (values: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (limit: ContributionLimitView) => void;
}

const STATUS_COLOR = { ok: "green", warning: "yellow", over: "red", unknown: "gray" } as const;

const GROUP_OPTIONS = (["IRA", "EMPLOYER_PLAN", "HSA"] as const).map((group) => ({
  value: group,
  label: LIMIT_GROUP_LABELS[group],
}));

/**
 * How much of each year's contribution room is used, and the caps themselves.
 *
 * The caps are entered by the owner, never shipped as constants: the IRS restates them annually,
 * and a stale figure in the source would still look authoritative. A group with no cap entered
 * for the year says so rather than implying room that may not exist.
 *
 * Room is shown per *group*, not per account, because that is how the rules work — a Roth IRA
 * and a Traditional IRA share one limit between them.
 */
export default function ContributionLimitsCard({ year, usage, limits, onSave, onDelete }: ContributionLimitsCardProps) {
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<ContributionLimitView | null>(null);
  const [group, setGroup] = useState<string | null>("IRA");
  const [variant, setVariant] = useState<string | null>("STANDARD");
  const [limit, setLimit] = useState<string | number>("");
  const [totalAdditionsLimit, setTotalAdditionsLimit] = useState<string | number>("");
  const [adjustment, setAdjustment] = useState<string | number>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setGroup(editing?.group ?? "IRA");
    setVariant(editing?.variant ?? "STANDARD");
    setLimit(editing?.limit ?? "");
    setTotalAdditionsLimit(editing?.totalAdditionsLimit ?? "");
    setAdjustment(editing?.contributedAdjustment ?? "");
    setError(null);
  }, [opened, editing]);

  const toNumber = (value: string | number) => (typeof value === "string" ? parseFloat(value) : value);

  const openFor = (existing: ContributionLimitView | null) => {
    setEditing(existing);
    setOpened(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!group || limit === "") {
      setError("A group and a limit are required");
      return;
    }

    setSubmitting(true);
    try {
      const response = await onSave({
        year,
        group,
        variant: group === "HSA" ? (variant ?? "HSA_SELF_ONLY") : "STANDARD",
        limit: toNumber(limit),
        totalAdditionsLimit: totalAdditionsLimit === "" ? null : toNumber(totalAdditionsLimit),
        contributedAdjustment: adjustment === "" ? 0 : toNumber(adjustment),
      });
      if (!response.ok) {
        setError(response.error ?? "Something went wrong");
        return;
      }
      setOpened(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={600}>Contribution room · {year}</Text>
            <Text size="xs" c="dimmed">
              Limits are yours to enter and check each year — nothing here is assumed
            </Text>
          </div>
          <Button size="xs" variant="default" leftSection={<IconPlus size={14} />} onClick={() => openFor(null)}>
            Set a limit
          </Button>
        </Group>

        {usage.length === 0 ? (
          <Text c="dimmed" size="sm">
            No accounts with an annual limit yet. IRAs, 401(k)s and HSAs are capped; plain savings is not.
          </Text>
        ) : (
          usage.map((row) => {
            const existing = limits.find((l) => l.group === row.group && l.variant === row.variant) ?? null;
            const percent = row.limit ? Math.min((row.contributed / row.limit) * 100, 100) : 0;
            return (
              <div key={`${row.group}:${row.variant}`}>
                <Group justify="space-between" align="baseline">
                  <Group gap="xs" align="baseline">
                    <Text size="sm" fw={500}>
                      {row.label}
                    </Text>
                    {row.group === "HSA" && (
                      <Text size="xs" c="dimmed">
                        {LIMIT_VARIANT_LABELS[row.variant]}
                      </Text>
                    )}
                    {row.status === "over" && (
                      <Badge color="red" variant="light">
                        Over the limit
                      </Badge>
                    )}
                    {row.status === "warning" && (
                      <Badge color="yellow" variant="light">
                        Nearly full
                      </Badge>
                    )}
                    {row.overTotalAdditions && (
                      <Tooltip label="Your money plus your employer's exceeds the combined cap">
                        <Badge color="red" variant="light">
                          Over combined cap
                        </Badge>
                      </Tooltip>
                    )}
                  </Group>
                  <Group gap={4}>
                    <Text size="sm">
                      {row.limit === null
                        ? `${formatCurrency(row.contributed)} in · no limit set`
                        : `${formatCurrency(row.contributed)} of ${formatCurrency(row.limit)}`}
                    </Text>
                    <Tooltip label={existing ? "Edit this limit" : "Set a limit for this group"}>
                      <ActionIcon variant="subtle" size="sm" onClick={() => openFor(existing)}>
                        <IconPencil size={14} />
                      </ActionIcon>
                    </Tooltip>
                    {existing && (
                      <Tooltip label="Remove this limit">
                        <ActionIcon variant="subtle" size="sm" color="red" onClick={() => onDelete(existing)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
                <Progress value={percent} color={STATUS_COLOR[row.status]} size="sm" mt={4} />
                <Group gap="md" mt={2}>
                  {row.limit !== null && (
                    <Text size="xs" c="dimmed">
                      {row.remaining !== null && row.remaining >= 0
                        ? `${formatCurrency(row.remaining)} of room left`
                        : `${formatCurrency(Math.abs(row.remaining ?? 0))} over`}
                    </Text>
                  )}
                  {row.employerContributed > 0 && (
                    <Text size="xs" c="dimmed">
                      employer added {formatCurrency(row.employerContributed)} (its own cap)
                    </Text>
                  )}
                  {row.rollovers > 0 && (
                    <Text size="xs" c="dimmed">
                      {formatCurrency(row.rollovers)} rolled in (counts against nothing)
                    </Text>
                  )}
                  {row.adjustment !== 0 && (
                    <Text size="xs" c="dimmed">
                      includes a manual adjustment of {formatCurrency(row.adjustment)}
                    </Text>
                  )}
                </Group>
              </div>
            );
          })
        )}
      </Stack>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={editing ? "Edit limit" : `Set a limit for ${year}`}
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 1 }}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            <Text size="sm" c="dimmed">
              Look up the figure for {year} and enter it — these change every year, so Folio never assumes one.
            </Text>
            <Select
              label="Applies to"
              data={GROUP_OPTIONS}
              value={group}
              onChange={setGroup}
              required
              allowDeselect={false}
              disabled={editing !== null}
            />
            {group === "HSA" && (
              <Select
                label="Coverage"
                data={[
                  { value: "HSA_SELF_ONLY", label: "Self-only" },
                  { value: "HSA_FAMILY", label: "Family" },
                ]}
                value={variant === "STANDARD" ? "HSA_SELF_ONLY" : variant}
                onChange={setVariant}
                allowDeselect={false}
                disabled={editing !== null}
              />
            )}
            <NumberInput
              label="Your annual limit"
              description="The most you personally may put in across this group"
              leftSection={<IconCurrencyDollar size={20} stroke={1.5} />}
              value={limit}
              onChange={setLimit}
              required
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              hideControls
            />
            {group === "EMPLOYER_PLAN" && (
              <NumberInput
                label="Combined cap"
                description="Optional — the larger cap covering your money plus your employer's"
                leftSection={<IconCurrencyDollar size={20} stroke={1.5} />}
                value={totalAdditionsLimit}
                onChange={setTotalAdditionsLimit}
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                hideControls
              />
            )}
            <NumberInput
              label="Manual adjustment"
              description="Contributions made outside Folio this year, e.g. at a previous employer. Negative to correct an overcount"
              leftSection={<IconCurrencyDollar size={20} stroke={1.5} />}
              value={adjustment}
              onChange={setAdjustment}
              decimalScale={2}
              fixedDecimalScale
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
    </Card>
  );
}
