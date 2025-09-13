"use client";

import { useState } from "react";
import { Button, Group, Paper, Stack, TextInput, Title, Switch, Select } from "@mantine/core";

export default function SettingsPage() {
    const [saving, setSaving] = useState(false);

    return (
        <Title order={2}>Settings</Title>
    );
}