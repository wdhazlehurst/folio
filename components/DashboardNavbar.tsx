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
import { usePathname } from "next/navigation";
import Link from "next/link";

const appVersion = packageJson.version;

const data = [
  { link: "/dashboard", label: "Dashboard", icon: IconHome, exact: true },
  { link: "/dashboard/expenses", label: "Expenses", icon: IconReceipt2, exact: false },
  { link: "/dashboard/worth", label: "Worth", icon: IconUserDollar, exact: false },
  { link: "/dashboard/charts", label: "Charts", icon: IconChartInfographic, exact: false },
  { link: "/dashboard/settings", label: "Settings", icon: IconSettings, exact: false },
];

export function DashboardNavbar() {
  const pathname = usePathname();

  return (
    <nav className={classes.navbar}>
      <div className={classes.navbarMain}>
        {data.map(({ link, label, icon: Icon }) => {
          const isActive =
            link === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === link || pathname.startsWith('${link}/')
           return (
            <Link
              key={label}
              href={link}
              className={classes.link}
              data-active={isActive || undefined} // your CSS uses [data-active] to style the active link
            >
              <Icon className={classes.linkIcon} stroke={1.5} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <Group className={classes.header} justify="space-between">
        <Code fw={700}>v{appVersion}</Code>
      </Group>
    </nav>
  );

}
