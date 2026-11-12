import { Stat } from "../../../ui/Stat";
import type { HealthItem } from "../lib/health";
import { HealthDot } from "./HealthDot";

export interface SystemHealthItemProps {
  item: HealthItem;
  size?: "md" | "sm";
}

export function SystemHealthItem({ item, size = "md" }: SystemHealthItemProps) {
  return (
    <li
      data-health-item
      data-health-id={item.id}
      data-health-tone={item.tone}
      className="bg-surface min-w-0"
    >
      <Stat
        label={item.label}
        value={item.value}
        hint={item.hint}
        hintTooltip={item.tooltip}
        size={size}
        leading={<HealthDot tone={item.tone} label={item.label} />}
        className={size === "md" ? "border-0 min-h-24" : "border-0 min-h-20"}
      />
    </li>
  );
}
