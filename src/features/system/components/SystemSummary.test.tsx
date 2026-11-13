import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemSummary } from "./SystemSummary";

describe("SystemSummary", () => {
  it("announces an all-healthy system politely", () => {
    render(<SystemSummary summary={{ tone: "healthy", issues: 0 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("All systems healthy");
    expect(screen.getByRole("img", { name: "System: Healthy" })).toBeInTheDocument();
  });

  it("counts one issue with the warning tone", () => {
    render(<SystemSummary summary={{ tone: "warning", issues: 1 }} />);
    expect(screen.getByText("1 issue needs attention")).toBeVisible();
    expect(screen.getByRole("img", { name: "System: Warning" })).toBeInTheDocument();
  });

  it("pluralises and keeps the critical tone", () => {
    render(<SystemSummary summary={{ tone: "critical", issues: 4 }} />);
    expect(screen.getByText("4 issues need attention")).toBeVisible();
    expect(screen.getByRole("img", { name: "System: Critical" })).toBeInTheDocument();
  });
});
