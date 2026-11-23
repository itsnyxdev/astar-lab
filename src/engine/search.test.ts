import { describe, it, expect } from "vitest";
import { runSearch, search } from "./search";
import {
  initialConfig,
  preset,
  makeProblem,
  generateMaze,
  shufflePuzzle,
  validateHeuristic,
  solvable,
} from "../environments";
import { algorithms, type Graph } from "./types";
import { reference } from "../analytics";
describe("report regressions", () => {
  for (const kind of ["maze", "puzzle"] as const)
    for (const algorithm of ["astar", "dijkstra", "greedy"] as const)
      it(`${kind} ${algorithm}`, () => {
        const r = runSearch({
          ...initialConfig(),
          environment: preset(kind),
          algorithm,
        });
        expect([r.pathCost, r.expandedNodes, r.generatedNodes]).toEqual(
          reference[`${kind}:${algorithm}`],
        );
      });
});
const graph: Graph = {
  kind: "graph",
  nodes: ["s", "a", "g"].map((id, i) => ({ id, x: i, y: 0, h: 0 })),
  edges: [
    { from: "s", to: "g", cost: 9 },
    { from: "s", to: "a", cost: 1 },
    { from: "a", to: "g", cost: 1 },
    { from: "a", to: "s", cost: 0 },
  ],
  start: "s",
  goal: "g",
  directed: true,
  heuristic: "zero",
};
describe("algorithms", () => {
  for (const algorithm of algorithms)
    it(`${algorithm} handles cycles and endpoints`, () => {
      const c = { ...initialConfig(), environment: graph, algorithm },
        r = runSearch(c);
      expect(r.found).toBe(true);
      expect(r.path[0]).toBe("s");
      expect(r.path.at(-1)).toBe("g");
      if (["astar", "dijkstra", "ida"].includes(algorithm))
        expect(r.pathCost).toBe(2);
      expect(
        runSearch({ ...c, environment: { ...graph, goal: "s" } }).expandedNodes,
      ).toBe(0);
      expect(
        runSearch({ ...c, environment: { ...graph, edges: [] } })
          .terminationReason,
      ).toBe("no-path");
    });
  it("limits safely and cancellation is explicit", () => {
    for (const limits of [
      { events: 8 },
      { expanded: 1 },
      { generated: 1 },
      { durationMs: 1 },
    ]) {
      const c = initialConfig();
      Object.assign(c.limits, limits);
      const ctrl = { cancelled: false, elapsedMs: 2 },
        g = search(c, ctrl);
      let r = g.next();
      while (!r.done) r = g.next();
      expect(r.value.terminationReason).toBe("limit-reached");
      expect(r.value.events.length).toBeLessThanOrEqual(c.limits.events);
    }
    const g = search(initialConfig(), { cancelled: true, elapsedMs: 0 });
    let cancelled = g.next();
    while (!cancelled.done) cancelled = g.next();
    expect(cancelled.value).toMatchObject({ terminationReason: "cancelled" });
  });
  it("reproducible trace and heap ties", () => {
    const a = runSearch(initialConfig()),
      b = runSearch(initialConfig());
    expect(a.events).toEqual(b.events);
    expect(a.occurrences).toEqual(b.occurrences);
  });
  it("reopens with inconsistent admissible heuristic", () => {
    const e: Graph = {
      ...graph,
      nodes: [
        { id: "s", x: 0, y: 0, h: 3 },
        { id: "a", x: 0, y: 0, h: 0 },
        { id: "b", x: 0, y: 0, h: 2 },
        { id: "g", x: 0, y: 0, h: 0 },
      ],
      edges: [
        { from: "s", to: "a", cost: 3 },
        { from: "s", to: "b", cost: 1 },
        { from: "b", to: "a", cost: 1 },
        { from: "a", to: "g", cost: 2 },
      ],
      heuristic: "custom",
    };
    expect(validateHeuristic(e)).toMatchObject({
      admissible: true,
      consistent: false,
    });
    expect(runSearch({ ...initialConfig(), environment: e }).pathCost).toBe(4);
  });
  it("rejects invalid inputs", () =>
    expect(() =>
      runSearch({
        ...initialConfig(),
        environment: { ...graph, edges: [{ from: "s", to: "g", cost: -1 }] },
      }),
    ).toThrow());
});
describe("environments", () => {
  it("seeded generators and solvability", () => {
    const m = preset("maze");
    if (m.kind !== "maze") throw Error();
    expect(generateMaze(m, "a", "perfect")).toEqual(
      generateMaze(m, "a", "perfect"),
    );
    const p = preset("puzzle");
    if (p.kind !== "puzzle") throw Error();
    const s = shufflePuzzle(p, "a", 30);
    expect(s).toEqual(shufflePuzzle(p, "a", 30));
    expect(solvable(s.start, s.goal)).toBe(true);
    expect(solvable([2, 1, 3, 4, 5, 6, 7, 8, 0], p.goal)).toBe(false);
  });
  it("goal-relative heuristic and no corner cutting", () => {
    const p = preset("puzzle");
    expect(makeProblem(p).heuristic(p.goal)).toBe(0);
    const m = {
      kind: "maze" as const,
      rows: 2,
      cols: 2,
      start: 0,
      goal: 3,
      walls: [1, 2],
      diagonal: true,
      order: ["down", "up", "right", "left"] as const,
    };
    expect(makeProblem({ ...m, order: [...m.order] }).neighbors(0)).toEqual([]);
  });
});
