import { expect, it } from "vitest";
import { Heap } from "./heap";
import { runSearch, search } from "./search";
import {
  initialConfig,
  generateGraph,
  validateHeuristic,
  makeProblem,
  preset,
  generateMaze,
  reachable,
  random,
} from "../environments";
import type { Algorithm, Graph } from "./types";
import { Timeline } from "../playback";
it("heap ordering is stable through inserts and removals", () => {
  const heap = new Heap<{ priority: number; counter: number }>(
      (a, b) =>
        a.priority < b.priority ||
        (a.priority === b.priority && a.counter < b.counter),
    ),
    rng = random("heap"),
    items = Array.from({ length: 1000 }, (_, counter) => ({
      priority: Math.floor(rng() * 8),
      counter,
    }));
  for (const i of items) heap.push(i);
  const actual = [];
  while (heap.size) actual.push(heap.pop());
  expect(actual).toEqual(
    items
      .slice()
      .sort((a, b) => a.priority - b.priority || a.counter - b.counter),
  );
  expect(heap.pop()).toBeUndefined();
});
it("optimal algorithms agree with independent Bellman–Ford on seeded weighted graphs", () => {
  for (let seed = 0; seed < 12; seed++) {
    const graph = generateGraph(String(seed)),
      expected = validateHeuristic(graph).distances[graph.start];
    for (const algorithm of ["astar", "dijkstra", "ida"] as Algorithm[]) {
      const r = runSearch({
        ...initialConfig(),
        environment: graph,
        algorithm,
      });
      expect(r.pathCost).toBe(expected);
    }
  }
});
it("stale entries are skipped, and logical frontier differs from physical heap", () => {
  const graph: Graph = {
    kind: "graph",
    nodes: ["s", "a", "b", "g"].map((id) => ({ id, x: 0, y: 0, h: 0 })),
    edges: [
      { from: "s", to: "a", cost: 10 },
      { from: "s", to: "b", cost: 1 },
      { from: "b", to: "a", cost: 1 },
    ],
    start: "s",
    goal: "g",
    directed: true,
    heuristic: "zero",
  };
  const r = runSearch({
    ...initialConfig(),
    environment: graph,
    algorithm: "dijkstra",
  });
  expect(r.events.filter((e) => e.type === "skip-stale")).toHaveLength(1);
  expect(r.expandedNodes).toBe(3);
  expect(r.generatedNodes).toBe(4);
  expect(r.finalFrontierSize).toBe(0);
  const t = new Timeline(r);
  for (const event of r.events)
    expect(t.at(event.index).frontier.size).toBe(event.frontier);
});
it("BFS and Greedy can choose an expensive direct edge", () => {
  const g: Graph = {
    kind: "graph",
    nodes: ["s", "a", "g"].map((id) => ({ id, x: 0, y: 0, h: 0 })),
    edges: [
      { from: "s", to: "g", cost: 9 },
      { from: "s", to: "a", cost: 1 },
      { from: "a", to: "g", cost: 1 },
    ],
    directed: true,
    start: "s",
    goal: "g",
    heuristic: "zero",
  };
  for (const algorithm of ["bfs", "greedy"] as Algorithm[])
    expect(
      runSearch({ ...initialConfig(), environment: g, algorithm }).pathCost,
    ).toBe(9);
  expect(runSearch({ ...initialConfig(), environment: g }).pathCost).toBe(2);
});
it("IDA iterations are explicit and replay stack matches every event", () => {
  const c = initialConfig();
  c.algorithm = "ida";
  const r = runSearch(c);
  expect(r.pathCost).toBe(18);
  expect(r.thresholds[0]).toBe(
    makeProblem(c.environment).heuristic(c.environment.start),
  );
  const t = new Timeline(r);
  for (const e of r.events)
    expect(t.at(e.index).frontier.size).toBe(e.frontier);
  for (let i = 1; i < r.thresholds.length; i++)
    expect(r.thresholds[i]).toBeGreaterThan(r.thresholds[i - 1]);
});
it("perfect mazes are connected reproducibly even when dimensions are even", () => {
  const e = preset("maze");
  if (e.kind !== "maze") throw Error();
  for (const seed of ["a", "b", "c"]) {
    const m = generateMaze(e, seed, "perfect");
    expect(reachable(m)).toBe(true);
    expect(m.rows % 2).toBe(1);
    expect(m.cols % 2).toBe(1);
  }
});
it("zero heuristic A* reproduces Dijkstra decisions", () => {
  const c = initialConfig();
  c.zeroHeuristic = true;
  const a = runSearch(c),
    b = runSearch({ ...c, algorithm: "dijkstra" });
  expect(a.path).toEqual(b.path);
  expect(a.events).toEqual(b.events);
});
it("cancels between a frontier pop and processing the goal", () => {
  const c = initialConfig();
  if (c.environment.kind !== "maze") throw Error();
  c.environment.goal = c.environment.start;
  const control = { cancelled: false, elapsedMs: 0 },
    g = search(c, control);
  g.next();
  g.next();
  g.next();
  control.cancelled = true;
  expect(g.next().value).toMatchObject({ terminationReason: "cancelled" });
});
it("rejects arithmetic overflow instead of reporting no path", () => {
  const graph: Graph = {
    kind: "graph",
    nodes: ["s", "a", "g"].map((id) => ({ id, x: 0, y: 0, h: 0 })),
    edges: [
      { from: "s", to: "a", cost: Number.MAX_VALUE },
      { from: "a", to: "g", cost: Number.MAX_VALUE },
    ],
    start: "s",
    goal: "g",
    directed: true,
    heuristic: "zero",
  };
  expect(() =>
    runSearch({
      ...initialConfig(),
      environment: graph,
      algorithm: "dijkstra",
    }),
  ).toThrow("invalid");
});
