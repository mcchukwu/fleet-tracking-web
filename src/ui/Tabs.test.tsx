import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

function Harness() {
  return (
    <Tabs defaultValue="map">
      <TabsList aria-label="Sections">
        <TabsTrigger value="map">Map</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
        <TabsTrigger value="trips">Trips</TabsTrigger>
      </TabsList>
      <TabsContent value="map">Map content</TabsContent>
      <TabsContent value="alerts">Alerts content</TabsContent>
      <TabsContent value="trips">Trips content</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("shows the selected panel and changes it on click", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Map content");
    await user.click(screen.getByRole("tab", { name: "Alerts" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Alerts content");
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();
    expect(screen.getByRole("tab", { name: "Map" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Alerts" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Alerts content");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Map" })).toHaveFocus();
  });
});
