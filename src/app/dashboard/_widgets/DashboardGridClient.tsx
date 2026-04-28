"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type DashboardGrid from "./DashboardGrid";

const DashboardGridDynamic = dynamic(() => import("./DashboardGrid"), { ssr: false });

export default function DashboardGridClient(props: ComponentProps<typeof DashboardGrid>) {
  return <DashboardGridDynamic {...props} />;
}
