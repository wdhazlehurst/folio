"use client";

import { useState } from "react";
import { Button, Group, Paper, Stack, TextInput, Title, Switch, Select, Divider, SegmentedControl, Text } from "@mantine/core";
import DisplayNameSettingWithSession from "./DisplayNameSettingWithSession";

export default function SettingsPage() {
    const [saving, setSaving] = useState(false);

    return (
        <Stack>
            <Title order={1}>Settings</Title>
            <Divider></Divider>
            <Title order={3}>Dashboard Settings</Title>
            <Divider></Divider>
            <Title order={3}>User Settings</Title>
            <Stack align="flex-start">
                <Title order={4}>Display Name</Title>
                <DisplayNameSettingWithSession />
            </Stack>
            <Group>
                <Text>Update Password</Text>
                <Button type="submit" >
              Update
            </Button>
            </Group>
            <Group>
                <Text>Delete Account</Text>
                <Button type="submit" color="red" >
              Delete
            </Button>
            </Group>
            <Divider></Divider>
        </Stack>
    );
}