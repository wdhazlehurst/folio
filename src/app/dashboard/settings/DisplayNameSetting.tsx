"use client";

import { useState, useTransition } from "react";
import { SegmentedControl, TextInput, Group, Button, Text, Stack, } from "@mantine/core";
import { StringValidation } from "zod/v3";
import classes from '@/css/GradientSegmentedControl.module.css'

type Mode = "email" | "custom";

export default function DisplayNameSetting({
    userEmail,
    initialMode = "email",
    initialDisplayName = "",
}: {
    userEmail: string;
    initialMode?: Mode;
    initialDisplayName?: string;
}) {
    const [mode, setMode] = useState<Mode>(initialMode);
    const [displayName, setDisplayName] = useState(initialDisplayName);
    const [pending, startTransition] = useTransition();

    const isCustom = mode === "custom";

    const onSave = () => {
        // validate client-side
        if (isCustom && displayName.trim().length < 2) return;
    };

    return (
        <Stack gap="xs">
            <Group>
                    <SegmentedControl classNames={classes} radius="md" size="md" orientation="vertical" value={mode} data={[
                        { label: "Email", value: "email" },
                        { label: "Custom display name", value: "custom" }, ]}
                        onChange={(v) => setMode(v as Mode)}
                    />
                    <Group align="end" wrap="nowrap">
                        <TextInput
                          label={isCustom ? "Custom display name" : "Email (read-only)"}
                          value={isCustom ? displayName : userEmail}
                          onChange={(e) => setDisplayName(e.currentTarget.value)}
                          readOnly={!isCustom}
                          placeholder="Display Name"
                          style={{ flex: 1 }}
                          error={isCustom && displayName.trim().length > 0 && displayName.trim().length < 2}
                        />
                        <Button onClick={onSave} loading={pending} disabled={isCustom && displayName.trim().length < 2}>
                            Update
                        </Button>
                    </Group>
                </Group>
                <Text size="sm" c="dimmed">
                    {isCustom
                        ? "Your custom name will be shown in the header."
                        : "Your email will be shown in the header."}
                </Text>
        </Stack>
    );
}