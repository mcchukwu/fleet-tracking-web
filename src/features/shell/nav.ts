import {
  Activity,
  BarChart3,
  Bell,
  FileUp,
  Map,
  MapPinned,
  Route,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "../../api/types";
import { can, type Capability } from "../../auth/roles";

export type NavPath =
  | "/map"
  | "/alerts"
  | "/trips"
  | "/drivers"
  | "/geofences"
  | "/import"
  | "/reports"
  | "/system"
  | "/audit";

export interface NavItem {
  to: NavPath;
  label: string;
  icon: LucideIcon;
  capability: Capability;
}

export const navItems: readonly NavItem[] = [
  { to: "/map", label: "Map", icon: Map, capability: "read" },
  { to: "/alerts", label: "Alerts", icon: Bell, capability: "read" },
  { to: "/trips", label: "Trips", icon: Route, capability: "read" },
  { to: "/drivers", label: "Drivers", icon: Users, capability: "read" },
  { to: "/geofences", label: "Geofences", icon: MapPinned, capability: "read" },
  { to: "/import", label: "Import", icon: FileUp, capability: "mutate" },
  { to: "/reports", label: "Reports", icon: BarChart3, capability: "read" },
  { to: "/system", label: "System", icon: Activity, capability: "read" },
  { to: "/audit", label: "Audit", icon: ScrollText, capability: "audit" },
];

export function navForRole(role: Role | undefined): NavItem[] {
  return navItems.filter((item) => can(role, item.capability));
}
