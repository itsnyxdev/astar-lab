import { test, expect } from "@playwright/test";
test("complete laboratory workflow with actual workers and exports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.locator("#language").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await expect(page.getByText(/Matches report/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Jump to start", exact: true })
    .click();
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Execution history" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jump to end", exact: true }).click();
  await page.getByRole("button", { name: "Search tree", exact: true }).click();
  await expect(page.locator(".tree-scroll svg")).toBeVisible();
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Learn through execution" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  await page
    .getByLabel("Experiment title", { exact: true })
    .fill("Maze verification");
  await page.getByRole("button", { name: "Save current", exact: true }).click();
  await expect(page.locator(".saved-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".saved-row")).toHaveCount(2);
  for (const extension of ["CSV", "JSON", "PDF"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: extension, exact: true }).click();
    const d = await download;
    await d.saveAs(`test-results/report.${extension.toLowerCase()}`);
  }
  await page.locator("#language").selectOption("fa");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await (await download).saveAs("test-results/report-fa.pdf");
  await page.locator("#language").selectOption("en");
  await page
    .getByRole("combobox", { name: "Environment", exact: true })
    .selectOption("puzzle");
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await expect(page.getByText(/Matches report/).first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "Environment", exact: true })
    .selectOption("graph");
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await expect(
    page.getByText("goal found", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByText("Edit problem & generation settings", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Validate heuristic", exact: true })
    .click();
  await expect(
    page.getByText("Admissible: Yes · Consistent: Yes", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#language").selectOption("fa");
  await page.screenshot({ path: "test-results/mobile-fa.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("comparison, cancellation, and storage reload", async ({ page }) => {
  await page.goto("/");
  await page.locator("#language").selectOption("en");
  await page
    .getByRole("button", { name: "Compare all six", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Compare all six", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  await page.getByRole("button", { name: "Save current", exact: true }).click();
  await expect(page.locator('.saved-row')).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(
    page.getByText("goal found", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Environment", exact: true })
    .selectOption("puzzle");
  await page
    .getByRole("combobox", { name: "Search algorithm", exact: true })
    .selectOption("dfs");
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("cancelled", { exact: true }).first(),
  ).toBeVisible();
});

test("editing, limits, theme, imports, and multi-page Persian PDF", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#language").selectOption("en");
  await page.locator("#theme").selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByText("Edit problem & generation settings", { exact: true })
    .click();
  await page.getByRole("button", { name: "Clear walls", exact: true }).click();
  await expect(page.getByText("Custom", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Check reachability", exact: true })
    .click();
  await expect(
    page.getByText("Goal is reachable.", { exact: true }),
  ).toBeVisible();
  await page.getByText("Execution limits", { exact: true }).click();
  await page.getByLabel("Expanded nodes", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await expect(
    page.getByText("limit reached", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Matches report/)).toHaveCount(0);
  await page.getByLabel("Expanded nodes", { exact: true }).fill("100000");
  await page
    .getByRole("button", { name: "Restore preset", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare all six", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Compare all six", exact: true }),
  ).toBeEnabled();
  await page.locator("#language").selectOption("fa");
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await (await pdf).saveAs("test-results/comparison-fa.pdf");
  await page.screenshot({ path: "test-results/dark-fa.png", fullPage: true });
  await page.locator("#language").selectOption("en");
  await page
    .getByLabel("Include full trace in JSON", { exact: true })
    .uncheck();
  const json = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await (await json).saveAs("test-results/summary.json");
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("test-results/summary.json");
  await expect(
    page.getByRole("button", { name: "Play replay", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByText("Run or load an experiment with a trace.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("alert")).toContainText("Invalid configuration");
});

test("pause/resume and worker failure release controls", async ({ page }) => {
  await page.goto("/");
  await page.locator("#language").selectOption("en");
  await page
    .getByRole("combobox", { name: "Environment", exact: true })
    .selectOption("puzzle");
  await page
    .getByRole("combobox", { name: "Search algorithm", exact: true })
    .selectOption("dfs");
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause computation", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Computation paused" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resume computation", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("cancelled", { exact: true }).first(),
  ).toBeVisible();
  await page.route("**/src/workers/search.worker.ts*", (route) =>
    route.abort(),
  );
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run search", exact: true }),
  ).toBeEnabled();
});

test("WebGL failure leaves accessible editors and search available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await page.locator("#language").selectOption("en");
  await expect(
    page.getByText(
      "3D rendering unavailable. The editor, history, and results remain accessible below.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await expect(page.getByText(/Matches report/).first()).toBeVisible();
});

test("large grid remains controllable, config-only files roundtrip, and reduced motion is usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#language").selectOption("en");
  await page
    .getByText("Edit problem & generation settings", { exact: true })
    .click();
  await page.getByRole("button", { name: "Clear walls", exact: true }).click();
  await page.getByLabel("Rows", { exact: true }).fill("100");
  await page.getByLabel("Columns", { exact: true }).fill("100");
  await page
    .getByRole("combobox", { name: "Search algorithm", exact: true })
    .selectOption("bfs");
  await page.getByRole("button", { name: "Run search", exact: true }).click();
  await expect(
    page.getByText("goal found", { exact: true }).first(),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".metrics")).toContainText("10,000");
  await page
    .getByRole("button", { name: "Jump to start", exact: true })
    .click();
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export configuration", exact: true })
    .click();
  await (await download).saveAs("test-results/configuration.json");
  await page
    .getByRole("combobox", { name: "Environment", exact: true })
    .selectOption("puzzle");
  await page
    .locator("input[type=file]")
    .setInputFiles("test-results/configuration.json");
  await expect(
    page.getByRole("combobox", { name: "Environment", exact: true }),
  ).toHaveValue("maze");
  await page.reload();
  await page
    .getByText("Edit problem & generation settings", { exact: true })
    .click();
  await expect(page.getByLabel("Rows", { exact: true })).toHaveValue("100");
  expect(errors).toEqual([]);
});
