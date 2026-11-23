export const algorithms = [
  "astar",
  "dijkstra",
  "greedy",
  "bfs",
  "dfs",
  "ida",
] as const;
export type Algorithm = (typeof algorithms)[number];
export type State = number | number[] | string;
export type Direction = "down" | "up" | "right" | "left";
export interface Maze {
  kind: "maze";
  rows: number;
  cols: number;
  walls: number[];
  start: number;
  goal: number;
  diagonal: boolean;
  order: Direction[];
}
export interface Puzzle {
  kind: "puzzle";
  start: number[];
  goal: number[];
  order: Direction[];
}
export interface Graph {
  kind: "graph";
  nodes: { id: string; x: number; y: number; h: number }[];
  edges: { from: string; to: string; cost: number }[];
  directed: boolean;
  start: string;
  goal: string;
  heuristic: "zero" | "euclidean" | "manhattan" | "custom";
}
export type Environment = Maze | Puzzle | Graph;
export interface Limits {
  expanded: number;
  generated: number;
  events: number;
  durationMs: number;
}
export interface ExperimentConfig {
  environment: Environment;
  algorithm: Algorithm;
  seed: string;
  shuffleMoves: number;
  limits: Limits;
  zeroHeuristic: boolean;
}
export interface Problem {
  start: State;
  key: (s: State) => string;
  goal: (s: State) => boolean;
  neighbors: (s: State) => { state: State; cost: number }[];
  heuristic: (s: State) => number;
}
export type EventType =
  | "initialize"
  | "push"
  | "pop"
  | "skip-stale"
  | "expand"
  | "discover"
  | "relax"
  | "reject"
  | "goal"
  | "iteration-start"
  | "iteration-end"
  | "backtrack"
  | "terminate";
export interface Occurrence {
  id: number;
  stateId: number;
  parent: number | null;
  g: number;
  h: number;
  priority: number;
  depth: number;
  iteration: number;
}
export interface SearchEvent {
  index: number;
  type: EventType;
  occurrence: number;
  frontier: number;
  expanded: number;
  generated: number;
  reason?: string;
  threshold?: number;
  targetStateId?: number;
  candidateG?: number;
}
export type Termination =
  "goal-found" | "no-path" | "cancelled" | "limit-reached";
export interface SearchResult {
  found: boolean;
  path: State[];
  pathOccurrences: number[];
  pathCost: number | null;
  expandedNodes: number;
  generatedNodes: number;
  maxFrontierSize: number;
  finalFrontierSize: number;
  maxPhysicalFrontier: number;
  maxDepth: number;
  repeatedStates: number;
  elapsedMs: number;
  workingMemoryBytes: number;
  traceBytes: number;
  terminationReason: Termination;
  states: State[];
  occurrences: Occurrence[];
  events: SearchEvent[];
  thresholds: number[];
}
export interface ExperimentRecord {
  schemaVersion: 1;
  appVersion: string;
  id: string;
  title: string;
  createdAt: string;
  config: ExperimentConfig;
  result: SearchResult;
  traceIncluded: boolean;
}
export type SearchTrace = Pick<
  SearchResult,
  "states" | "occurrences" | "events"
>;
export const defaultLimits: Limits = {
  expanded: 100000,
  generated: 250000,
  events: 1000000,
  durationMs: 30000,
};
