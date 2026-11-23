import { preset } from "../environments";
import type { ExperimentConfig, SearchResult } from "../engine/types";
export const reference: Record<string, readonly number[]> = {
  "maze:astar": [18, 27, 35],
  "maze:dijkstra": [18, 64, 69],
  "maze:greedy": [22, 22, 32],
  "puzzle:astar": [16, 84, 139],
  "puzzle:dijkstra": [16, 8162, 12906],
  "puzzle:greedy": [28, 101, 171],
};
export function reportMatch(c: ExperimentConfig, r: SearchResult) {
  const expected = reference[`${c.environment.kind}:${c.algorithm}`];
  return (
    !!expected &&
    !c.zeroHeuristic &&
    JSON.stringify(c.environment) ===
      JSON.stringify(preset(c.environment.kind)) &&
    r.terminationReason === "goal-found" &&
    [r.pathCost, r.expandedNodes, r.generatedNodes].every(
      (v, i) => v === expected[i],
    )
  );
}
export function comparable(a: ExperimentConfig, b: ExperimentConfig) {
  return (
    JSON.stringify(a.environment) === JSON.stringify(b.environment) &&
    a.zeroHeuristic === b.zeroHeuristic &&
    JSON.stringify(a.limits) === JSON.stringify(b.limits)
  );
}
