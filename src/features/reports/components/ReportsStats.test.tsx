import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ReportSummary } from "../../../api/types";
import { ReportsStats } from "./ReportsStats";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: Record<string, string>;
    children: ReactNode;
  }) => (
    <a
      href={`${to}${search ? `?${new URLSearchParams(search).toString()}` : ""}`}
      data-to={to}
      data-search={search ? JSON.stringify(search) : ""}
    >
      {children}
    </a>
  ),
}));

function summary(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    vehicles: 25,
    trips: 8,
    completed_trips: 1,
    active_trips: 4,
    alerts: 66,
    open_alerts: 45,
    distance_km: 10917.07,
    alerts_by_type: [],
    ...overrides,
  };
}

describe("ReportsStats", () => {
  it("renders all seven numbers with units and hints", () => {
    render(<ReportsStats summary={summary()} />);

    expect(screen.getByText("Vehicles")).toBeVisible();
    expect(screen.getByText("25")).toBeVisible();
    expect(screen.getByText("Fleet total")).toBeVisible();
    expect(screen.getByText("8")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.getByText("13% of trips")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getByText("66")).toBeVisible();
    expect(screen.getByText("45")).toBeVisible();
    expect(screen.getByText("10,917 km")).toBeVisible();
  });

  it("links each scoped stat to a real destination", () => {
    render(<ReportsStats summary={summary()} />);

    expect(screen.getByRole("link", { name: /^Vehicles/ })).toHaveAttribute("data-to", "/map");
    expect(screen.getByRole("link", { name: /^Trips/ })).toHaveAttribute("data-to", "/trips");
    expect(screen.getByRole("link", { name: /^Completed trips/ })).toHaveAttribute(
      "data-search",
      JSON.stringify({ status: "completed" }),
    );
    expect(screen.getByRole("link", { name: /^Active trips/ })).toHaveAttribute(
      "data-search",
      JSON.stringify({ status: "active" }),
    );
    expect(screen.getByRole("link", { name: /^Alerts/ })).toHaveAttribute("data-to", "/alerts");
    expect(screen.getByRole("link", { name: /^Open alerts/ })).toHaveAttribute(
      "data-search",
      JSON.stringify({ status: "open" }),
    );
    expect(screen.queryByRole("link", { name: /^Distance/ })).toBeNull();
    expect(screen.getByText("Distance")).toBeVisible();
  });

  it("shows the missing value for the completion hint when there were no trips", () => {
    render(<ReportsStats summary={summary({ trips: 0, completed_trips: 0 })} />);
    const completed = screen.getByText("Completed trips").closest("a");
    if (!completed) throw new Error("Completed trips is not linked");
    expect(within(completed).getByText("—")).toBeVisible();
  });

  it("states that the links open the full lists", () => {
    render(<ReportsStats summary={summary()} />);
    expect(screen.getByText(/Trip and alert numbers cover the selected range/)).toBeVisible();
  });
});
