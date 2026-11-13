import { expect, test } from "./fixtures";

const columns = ["status", "severity", "type", "trip"] as const;

const prefix: Record<(typeof columns)[number], string> = {
  status: "Unknown status: ",
  severity: "Unknown severity: ",
  type: "Unknown type: ",
  trip: "Unknown status: ",
};

const unknownLength = 60;
const inset = 12;
const tolerance = 1;

test("a long unknown badge ellipsizes in every table column", async ({ page }) => {
  await page.goto("/styleguide#badge-overflow");

  const table = page.getByRole("table", { name: "Unknown values in cells" });
  await table.scrollIntoViewIfNeeded();
  await expect(table).toBeVisible();

  for (const id of columns) {
    const cell = table.locator(`td[data-column-id="${id}"]`);
    await expect(cell).toHaveCount(1);

    const metrics = await cell.evaluate((td) => {
      const content = td.querySelector<HTMLElement>("[data-cell-content]");
      const badge = content?.firstElementChild as HTMLElement | null;
      const label = badge?.querySelector<HTMLElement>("[data-badge-label]");
      if (!content || !badge || !label) {
        throw new Error("The cell has no badge with a label");
      }

      const labelStyle = getComputedStyle(label);
      const tdRect = td.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const badgeRect = badge.getBoundingClientRect();

      return {
        text: label.textContent ?? "",
        title: td.getAttribute("title") ?? "",
        labelOverflowX: labelStyle.overflowX,
        labelTextOverflow: labelStyle.textOverflow,
        labelWhiteSpace: labelStyle.whiteSpace,
        labelScrollWidth: label.scrollWidth,
        labelClientWidth: label.clientWidth,
        contentScrollWidth: content.scrollWidth,
        contentClientWidth: content.clientWidth,
        contentRight: contentRect.right,
        cellScrollWidth: td.scrollWidth,
        cellClientWidth: td.clientWidth,
        cellLeft: tdRect.left,
        cellRight: tdRect.right,
        badgeLeft: badgeRect.left,
        badgeRight: badgeRect.right,
      };
    });

    const value = metrics.text.slice(prefix[id].length);

    expect(metrics.text.startsWith(prefix[id])).toBe(true);
    expect(value).toHaveLength(unknownLength);
    expect(metrics.title).toBe(metrics.text);

    expect(metrics.labelWhiteSpace).toBe("nowrap");
    expect(metrics.labelOverflowX).toBe("hidden");
    expect(metrics.labelTextOverflow).toBe("ellipsis");
    expect(metrics.labelScrollWidth).toBeGreaterThan(metrics.labelClientWidth);

    expect(metrics.contentScrollWidth).toBeLessThanOrEqual(metrics.contentClientWidth + tolerance);
    expect(metrics.cellScrollWidth).toBeLessThanOrEqual(metrics.cellClientWidth + tolerance);
    expect(metrics.badgeRight).toBeLessThanOrEqual(metrics.contentRight + tolerance);
    expect(metrics.badgeLeft - metrics.cellLeft).toBeGreaterThanOrEqual(inset - tolerance);
    expect(metrics.cellRight - metrics.badgeRight).toBeGreaterThanOrEqual(inset - tolerance);
  }
});
