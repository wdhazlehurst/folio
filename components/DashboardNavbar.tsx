import { useState } from "react";
import {
  IconReceipt2,
  IconChartInfographic,
  IconUserDollar,
  IconSettings,
  IconHome,
} from "@tabler/icons-react";
import { Code, Group } from "@mantine/core";
import classes from "@/css/NavbarSimple.module.css";
import packageJson from "../package.json";

const appVersion = packageJson.version;

const data = [
  { link: "", label: "Dashboard", icon: IconHome },
  { link: "", label: "Expenses", icon: IconReceipt2 },
  { link: "", label: "Worth", icon: IconUserDollar },
  { link: "", label: "Charts", icon: IconChartInfographic },
  { link: "", label: "Settings", icon: IconSettings },
];

export function DashboardNavbar() {
  const [active, setActive] = useState("Dashboard");

  const links = data.map((item) => (
    <a
      className={classes.link}
      data-active={item.label === active || undefined}
      href={item.link}
      key={item.label}
      onClick={(event) => {
        event.preventDefault();
        setActive(item.label);
      }}
    >
      <item.icon className={classes.linkIcon} stroke={1.5} />
      <span>{item.label}</span>
    </a>
  ));

  return (
    <nav className={classes.navbar}>
      <div className={classes.navbarMain}>{links}</div>
      <Group className={classes.header} justify="space-between">
        <Code fw={700}>v{appVersion}</Code>
      </Group>
    </nav>
  );
}
