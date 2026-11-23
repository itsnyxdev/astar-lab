import {
  defaultLimits,
  type Direction,
  type Environment,
  type ExperimentConfig,
  type Graph,
  type Maze,
  type Problem,
  type Puzzle,
  type State,
} from "../engine/types";
export const order: Direction[] = ["down", "up", "right", "left"];
export const deltas: Record<Direction, [number, number]> = {
  down: [1, 0],
  up: [-1, 0],
  right: [0, 1],
  left: [0, -1],
};
const layout = [
  ".##..#....",
  "..#.......",
  ".##..#....",
  "..###...#.",
  "..##.#..#.",
  "#........#",
  "####..##.#",
  ".#...#....",
  ".....#..#.",
  "...#...#..",
];
export function preset(kind: Environment["kind"]): Environment {
  if (kind === "maze")
    return {
      kind,
      rows: 10,
      cols: 10,
      walls: layout
        .join("")
        .split("")
        .flatMap((c, i) => (c === "#" ? [i] : [])),
      start: 0,
      goal: 99,
      diagonal: false,
      order: [...order],
    };
  if (kind === "puzzle")
    return {
      kind,
      start: [0, 6, 8, 1, 4, 5, 7, 3, 2],
      goal: [1, 2, 3, 4, 5, 6, 7, 8, 0],
      order: [...order],
    };
  return {
    kind,
    directed: true,
    start: "A",
    goal: "E",
    heuristic: "zero",
    nodes: [
      { id: "A", x: -3, y: 0, h: 4 },
      { id: "B", x: -1, y: 2, h: 2 },
      { id: "C", x: -1, y: -2, h: 3 },
      { id: "D", x: 1, y: 1, h: 1 },
      { id: "E", x: 3, y: 0, h: 0 },
    ],
    edges: [
      { from: "A", to: "B", cost: 2 },
      { from: "A", to: "C", cost: 1 },
      { from: "B", to: "D", cost: 1 },
      { from: "C", to: "D", cost: 5 },
      { from: "D", to: "E", cost: 1 },
      { from: "B", to: "E", cost: 6 },
    ],
  };
}
export function initialConfig(): ExperimentConfig {
  return {
    environment: preset("maze"),
    algorithm: "astar",
    seed: "search-lab",
    shuffleMoves: 24,
    limits: { ...defaultLimits },
    zeroHeuristic: false,
  };
}
export const key = (s: State) => (Array.isArray(s) ? s.join(",") : String(s));
function permutation(a: number[]) {
  return (
    Array.isArray(a) &&
    a.length === 9 &&
    new Set(a).size === 9 &&
    a.every((n) => Number.isInteger(n) && n >= 0 && n <= 8)
  );
}
function parity(a: number[]) {
  let n = 0;
  for (let i = 0; i < 9; i++)
    for (let j = i + 1; j < 9; j++) if (a[i] && a[j] && a[i] > a[j]) n++;
  return n % 2;
}
export function solvable(a: number[], b: number[]) {
  return permutation(a) && permutation(b) && parity(a) === parity(b);
}
/** Validates all externally supplied configuration before execution or persistence. */
export function validateEnvironment(e: Environment): void {
  if (!e || !["maze", "puzzle", "graph"].includes(e.kind))
    throw Error("invalid");
  if (
    e.kind !== "graph" &&
    (!Array.isArray(e.order) ||
      e.order.length !== 4 ||
      new Set(e.order).size !== 4 ||
      !e.order.every((d) => order.includes(d)))
  )
    throw Error("invalid");
  if (e.kind === "maze") {
    if (
      !Number.isInteger(e.rows) ||
      !Number.isInteger(e.cols) ||
      e.rows < 2 ||
      e.cols < 2 ||
      e.rows > 100 ||
      e.cols > 100 ||
      typeof e.diagonal !== "boolean" ||
      !Array.isArray(e.walls)
    )
      throw Error("invalid");
    const valid = (n: number) =>
      Number.isInteger(n) && n >= 0 && n < e.rows * e.cols;
    if (
      !valid(e.start) ||
      !valid(e.goal) ||
      !e.walls.every(valid) ||
      new Set(e.walls).size !== e.walls.length ||
      e.walls.includes(e.start) ||
      e.walls.includes(e.goal)
    )
      throw Error("invalid");
  } else if (e.kind === "puzzle") {
    if (!permutation(e.start) || !permutation(e.goal)) throw Error("invalid");
    if (!solvable(e.start, e.goal)) throw Error("unsolvable");
  } else {
    if (
      !Array.isArray(e.nodes) ||
      !Array.isArray(e.edges) ||
      !e.nodes.length ||
      e.nodes.length > 200 ||
      e.edges.length > 2000 ||
      typeof e.directed !== "boolean" ||
      !["zero", "euclidean", "manhattan", "custom"].includes(e.heuristic)
    )
      throw Error("invalid");
    const ids = new Set(e.nodes.map((n) => n.id));
    if (
      ids.size !== e.nodes.length ||
      !ids.has(e.start) ||
      !ids.has(e.goal) ||
      e.nodes.some(
        (n) =>
          typeof n.id !== "string" ||
          !n.id.length ||
          n.id.length > 40 ||
          ![n.x, n.y, n.h].every(Number.isFinite) ||
          n.h < 0,
      ) ||
      e.edges.some(
        (a) =>
          !ids.has(a.from) ||
          !ids.has(a.to) ||
          !Number.isFinite(a.cost) ||
          a.cost < 0,
      )
    )
      throw Error("invalid");
  }
}
export function makeProblem(e: Environment, zero = false): Problem {
  validateEnvironment(e);
  if (e.kind === "maze") {
    const walls = new Set(e.walls),
      xy = (s: State) => [Math.floor(Number(s) / e.cols), Number(s) % e.cols];
    const valid = (r: number, c: number) =>
      r >= 0 &&
      c >= 0 &&
      r < e.rows &&
      c < e.cols &&
      !walls.has(r * e.cols + c);
    return {
      start: e.start,
      key,
      goal: (s) => s === e.goal,
      heuristic: (s) => {
        if (zero) return 0;
        const [r, c] = xy(s),
          [gr, gc] = xy(e.goal),
          a = Math.abs(r - gr),
          b = Math.abs(c - gc);
        return e.diagonal
          ? Math.max(a, b) + (Math.SQRT2 - 1) * Math.min(a, b)
          : a + b;
      },
      neighbors: (s) => {
        const [r, c] = xy(s);
        const ds = e.order.map((d) => deltas[d]);
        if (e.diagonal) ds.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        return ds.flatMap(([dr, dc]) =>
          valid(r + dr, c + dc) &&
          (!(dr && dc) || (valid(r + dr, c) && valid(r, c + dc)))
            ? [
                {
                  state: (r + dr) * e.cols + c + dc,
                  cost: dr && dc ? Math.SQRT2 : 1,
                },
              ]
            : [],
        );
      },
    };
  }
  if (e.kind === "puzzle")
    return {
      start: e.start,
      key,
      goal: (s) => key(s) === key(e.goal),
      heuristic: (s) =>
        zero
          ? 0
          : (s as number[]).reduce((v, t, i) => {
              if (!t) return v;
              const j = e.goal.indexOf(t);
              return (
                v +
                Math.abs(Math.floor(i / 3) - Math.floor(j / 3)) +
                Math.abs((i % 3) - (j % 3))
              );
            }, 0),
      neighbors: (s) => {
        const a = s as number[],
          i = a.indexOf(0),
          r = Math.floor(i / 3),
          c = i % 3;
        return e.order.flatMap((d) => {
          const [dr, dc] = deltas[d],
            rr = r + dr,
            cc = c + dc;
          if (rr < 0 || rr > 2 || cc < 0 || cc > 2) return [];
          const b = [...a],
            j = rr * 3 + cc;
          [b[i], b[j]] = [b[j], b[i]];
          return [{ state: b, cost: 1 }];
        });
      },
    };
  const nodes = new Map(e.nodes.map((n) => [n.id, n])),
    goal = nodes.get(e.goal)!;
  return {
    start: e.start,
    key,
    goal: (s) => s === e.goal,
    heuristic: (s) => {
      if (zero || e.heuristic === "zero") return 0;
      const n = nodes.get(String(s))!;
      return e.heuristic === "custom"
        ? n.h
        : e.heuristic === "euclidean"
          ? Math.hypot(n.x - goal.x, n.y - goal.y)
          : Math.abs(n.x - goal.x) + Math.abs(n.y - goal.y);
    },
    neighbors: (s) =>
      e.edges.flatMap((a) =>
        a.from === s
          ? [{ state: a.to, cost: a.cost }]
          : !e.directed && a.to === s
            ? [{ state: a.from, cost: a.cost }]
            : [],
      ),
  };
}
/** Seeded xorshift32, with a stable UTF-16 string hash. */
export function random(seed: string) {
  let s = 2166136261;
  for (const c of seed) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  if (!s) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
export function generateMaze(
  e: Maze,
  seed: string,
  strategy: "obstacles" | "perfect",
  density = 0.28,
): Maze {
  const rng = random(seed);
  if (strategy === "obstacles")
    return {
      ...e,
      walls: Array.from({ length: e.rows * e.cols }, (_, i) => i).filter(
        (i) => i !== e.start && i !== e.goal && rng() < density,
      ),
    };
  const rows = e.rows % 2 ? e.rows : Math.max(3, e.rows - 1),
    cols = e.cols % 2 ? e.cols : Math.max(3, e.cols - 1),
    walls = new Set(Array.from({ length: rows * cols }, (_, i) => i)),
    stack = [0];
  walls.delete(0);
  while (stack.length) {
    const p = stack[stack.length - 1],
      r = Math.floor(p / cols),
      c = p % cols;
    const ns = order
      .map((d) => deltas[d])
      .filter(
        ([dr, dc]) =>
          r + dr * 2 >= 0 &&
          r + dr * 2 < rows &&
          c + dc * 2 >= 0 &&
          c + dc * 2 < cols &&
          walls.has((r + dr * 2) * cols + c + dc * 2),
      );
    if (!ns.length) {
      stack.pop();
      continue;
    }
    const [dr, dc] = ns[Math.floor(rng() * ns.length)],
      n = (r + dr * 2) * cols + c + dc * 2;
    walls.delete((r + dr) * cols + c + dc);
    walls.delete(n);
    stack.push(n);
  }
  return {
    ...e,
    rows,
    cols,
    start: 0,
    goal: rows * cols - 1,
    walls: [...walls],
    diagonal: false,
  };
}
export function shufflePuzzle(e: Puzzle, seed: string, moves: number): Puzzle {
  const rng = random(seed),
    p = makeProblem(e);
  let s: State = [...e.goal],
    previous = "";
  for (let i = 0; i < moves; i++) {
    const ns: { state: State; cost: number }[] = p
      .neighbors(s)
      .filter((n) => key(n.state) !== previous);
    previous = key(s);
    s = ns[Math.floor(rng() * ns.length)].state;
  }
  return { ...e, start: s as number[] };
}
export function generateGraph(seed: string): Graph {
  const rng = random(seed),
    nodes = Array.from({ length: 12 }, (_, i) => ({
      id: String(i + 1),
      x: Math.cos((i * Math.PI) / 6) * 5,
      y: Math.sin((i * Math.PI) / 6) * 5,
      h: 0,
    })),
    edges: Graph["edges"] = [];
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      if (j === i + 1 || rng() < 0.15)
        edges.push({
          from: nodes[i].id,
          to: nodes[j].id,
          cost: 1 + Math.floor(rng() * 9),
        });
  return {
    kind: "graph",
    nodes,
    edges,
    directed: false,
    start: "1",
    goal: "12",
    heuristic: "zero",
  };
}
export function reachable(e: Environment) {
  const p = makeProblem(e),
    seen = new Set([key(p.start)]),
    q = [p.start];
  for (let i = 0; i < q.length; i++) {
    if (p.goal(q[i])) return true;
    for (const n of p.neighbors(q[i]))
      if (!seen.has(key(n.state))) {
        seen.add(key(n.state));
        q.push(n.state);
      }
  }
  return false;
}
/** Independent reverse Bellman–Ford reference, not the production search engine. */
export function validateHeuristic(e: Graph) {
  validateEnvironment(e);
  const d: Record<string, number> = Object.fromEntries(
    e.nodes.map((n) => [n.id, n.id === e.goal ? 0 : Infinity]),
  );
  const edges = e.directed
    ? e.edges
    : e.edges.flatMap((a) => [a, { from: a.to, to: a.from, cost: a.cost }]);
  for (let i = 1; i < e.nodes.length; i++) {
    let changed = false;
    for (const a of edges)
      if (d[a.from] > a.cost + d[a.to]) {
        d[a.from] = a.cost + d[a.to];
        changed = true;
      }
    if (!changed) break;
  }
  const p = makeProblem(e),
    admissible = e.nodes.every((n) => p.heuristic(n.id) <= d[n.id] + 1e-9),
    consistent =
      edges.every(
        (a) => p.heuristic(a.from) <= a.cost + p.heuristic(a.to) + 1e-9,
      ) && p.heuristic(e.goal) === 0;
  return { admissible, consistent, distances: d };
}
