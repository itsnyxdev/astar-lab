import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  save,
  list,
  remove,
  validateRecord,
  saveConfiguration,
  readConfiguration,
} from "./storage";
import { runSearch } from "../engine/search";
import { initialConfig } from "../environments";
import { csv, jsonRecord } from "./export";
import type { ExperimentRecord } from "../engine/types";
const record = (): ExperimentRecord => ({
  schemaVersion: 1,
  appVersion: "1.0.0",
  id: "test",
  title: "=SUM(A1)",
  createdAt: new Date().toISOString(),
  config: initialConfig(),
  result: runSearch(initialConfig()),
  traceIncluded: true,
});
it("roundtrips experiments transactionally and rejects damaged traces", async () => {
  const r = record();
  await save(r);
  expect((await list())[0]).toEqual(r);
  await remove(r.id);
  expect(await list()).toEqual([]);
  r.result.events[0].occurrence = 999999;
  expect(() => validateRecord(r)).toThrow("invalid");
});
it("validates summary exports and escapes spreadsheet values", () => {
  const r = record(),
    s = jsonRecord(r, false);
  expect(() => validateRecord(s)).not.toThrow();
  expect(s.result.path).toEqual(r.result.path);
  expect(s.result.events).toHaveLength(0);
  r.config.seed = "=1+1";
  expect(csv([r])).toContain("'=1+1");
  expect(() => validateRecord({ ...r, schemaVersion: 2 })).toThrow();
});
it("persists configurations without inventing a search result", () => {
  const c = initialConfig();
  c.seed = "custom";
  saveConfiguration(c);
  expect(readConfiguration()).toEqual(c);
  localStorage.setItem("search-laboratory-configuration", "{}");
  expect(readConfiguration()).toBeNull();
});
it("rejects inconsistent metrics and illegal returned paths", () => {
  const r = record();
  r.result.expandedNodes++;
  expect(() => validateRecord(r)).toThrow("invalid");
  const p = record();
  p.result.path = [0, 99];
  expect(() => validateRecord(p)).toThrow("invalid");
});
