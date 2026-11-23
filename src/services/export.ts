import type { ExperimentRecord } from "../engine/types";

export function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function jsonRecord(
  r: ExperimentRecord,
  trace: boolean,
): ExperimentRecord {
  return trace
    ? r
    : {
        ...r,
        traceIncluded: false,
        result: {
          ...r.result,
          states: [],
          occurrences: [],
          events: [],
          pathOccurrences: [],
        },
      };
}
export function csv(records: ExperimentRecord[]) {
  const safe = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows: unknown[][] = [
    [
      "id",
      "algorithm",
      "environment",
      "termination",
      "path_cost",
      "path_length",
      "expanded",
      "generated",
      "peak_frontier",
      "final_frontier",
      "peak_heap_or_stack",
      "max_depth",
      "repeated",
      "working_memory_estimate_bytes",
      "trace_estimate_bytes",
      "engine_ms",
      "seed",
    ],
  ];
  for (const r of records) {
    const v = r.result;
    rows.push([
      r.id,
      r.config.algorithm,
      r.config.environment.kind,
      v.terminationReason,
      v.pathCost,
      v.found ? v.path.length - 1 : null,
      v.expandedNodes,
      v.generatedNodes,
      v.maxFrontierSize,
      v.finalFrontierSize,
      v.maxPhysicalFrontier,
      v.maxDepth,
      v.repeatedStates,
      v.workingMemoryBytes,
      v.traceBytes,
      v.elapsedMs,
      r.config.seed,
    ]);
  }
  return "\uFEFF" + rows.map((row) => row.map(safe).join(",")).join("\r\n");
}
export { pdf } from "./pdf";
