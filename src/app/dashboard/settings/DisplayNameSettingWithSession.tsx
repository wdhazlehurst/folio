"use client";

import { useSession } from "next-auth/react";
import { Skeleton } from "@mantine/core";
import DisplayNameSetting from "./DisplayNameSetting";

export default function DisplayNameSettingWithSession() {
  const { data: session, status } = useSession();

  if (status === "loading") return <Skeleton h={80} radius="md" />;

  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? "";

  return <DisplayNameSetting userEmail={email} initialMode="email" initialDisplayName={name} />;
}
