import type { RefObject } from "react";
import { Button } from "../../../ui/Button";

export const DEMO_PASSWORD = "DemoPass123!";

export const demoAccounts = [
  { label: "Admin", email: "admin@demo.ftb" },
  { label: "Dispatcher", email: "dispatcher@demo.ftb" },
  { label: "Security", email: "security@demo.ftb" },
  { label: "Viewer", email: "viewer@demo.ftb" },
] as const;

interface DemoEnv {
  DEV: boolean;
  VITE_DEMO_HINTS?: string | boolean;
}

export function demoHintsEnabled(env: DemoEnv = import.meta.env): boolean {
  return env.DEV === true && env.VITE_DEMO_HINTS === "1";
}

export interface DemoHintsProps {
  onPrefill: (email: string, password: string) => void;
  submitRef?: RefObject<HTMLButtonElement | null>;
}

export function DemoHints({ onPrefill, submitRef }: DemoHintsProps) {
  if (!demoHintsEnabled()) return null;

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="label-caps text-muted">Demo accounts</p>
      <div className="flex flex-wrap gap-1">
        {demoAccounts.map((account) => (
          <Button
            key={account.email}
            size="sm"
            variant="ghost"
            onClick={() => {
              onPrefill(account.email, DEMO_PASSWORD);
              submitRef?.current?.focus();
            }}
          >
            {account.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
