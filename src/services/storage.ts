import type { ExperimentRecord, ExperimentConfig } from "../engine/types";
import { validateConfig } from "../engine/search";
import { makeProblem } from "../environments";
export function saveConfiguration(config: ExperimentConfig) {
  validateConfig(config);
  try {
    localStorage.setItem(
      "search-laboratory-configuration",
      JSON.stringify({ schemaVersion: 1, kind: "configuration", config }),
    );
  } catch {
    throw Error("storage");
  }
}
export function readConfiguration(): ExperimentConfig | null {
  try {
    const text = localStorage.getItem("search-laboratory-configuration");
    if (!text) return null;
    const value = JSON.parse(text) as {
      schemaVersion: number;
      kind: string;
      config: ExperimentConfig;
    };
    if (value.schemaVersion !== 1 || value.kind !== "configuration")
      return null;
    validateConfig(value.config);
    return value.config;
  } catch {
    return null;
  }
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open("search-laboratory", 1);
    q.onupgradeneeded = () =>
      q.result.createObjectStore("experiments", { keyPath: "id" });
    q.onsuccess = () => {
      q.result.onversionchange = () => q.result.close();
      resolve(q.result);
    };
    q.onerror = () => reject(Error("storage"));
    q.onblocked = () => reject(Error("storage"));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction, req: IDBRequest<T>;
    try {
      tx = db.transaction("experiments", mode);
      req = action(tx.objectStore("experiments"));
    } catch {
      db.close();
      reject(Error("storage"));
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(Error("storage"));
    };
  });
}
export async function save(record: ExperimentRecord) {
  validateRecord(record);
  await transaction("readwrite", (s) => s.put(record));
}
export async function list() {
  const records=await transaction<ExperimentRecord[]>("readonly", (s) => s.getAll());
  records.forEach(validateRecord);
  return records;
}
export async function remove(id: string) {
  await transaction("readwrite", (s) => s.delete(id));
}
/** Imported files are untrusted, including their trace references and metric values. */
export function validateRecord(
  value: unknown,
): asserts value is ExperimentRecord {
  if (!value || typeof value !== "object") throw Error("invalid");
  const r = value as ExperimentRecord;
  if (
    r.schemaVersion !== 1 ||
    typeof r.id !== "string" ||
    r.id.length > 200 ||
    typeof r.title !== "string" ||
    r.title.length > 500 ||
    typeof r.createdAt !== "string" ||
    !Number.isFinite(Date.parse(r.createdAt)) ||
    typeof r.appVersion !== "string" ||
    typeof r.traceIncluded !== "boolean"
  )
    throw Error("invalid");
  validateConfig(r.config);
  const v = r.result;
  if (
    !v ||
    !["goal-found", "no-path", "cancelled", "limit-reached"].includes(
      v.terminationReason,
    ) ||
    v.found !== (v.terminationReason === "goal-found") ||
    ![
      v.expandedNodes,
      v.generatedNodes,
      v.maxFrontierSize,
      v.finalFrontierSize,
      v.maxPhysicalFrontier,
      v.maxDepth,
      v.repeatedStates,
      v.elapsedMs,
      v.workingMemoryBytes,
      v.traceBytes,
    ].every((n) => Number.isFinite(n) && n >= 0) ||
    !(
      v.pathCost === null ||
      (Number.isFinite(v.pathCost) && v.pathCost >= 0)
    ) ||
    !Array.isArray(v.path) ||
    !Array.isArray(v.states) ||
    !Array.isArray(v.occurrences) ||
    !Array.isArray(v.events) ||
    !Array.isArray(v.thresholds) ||
    !Array.isArray(v.pathOccurrences) ||
    v.events.length > 2000000 ||
    v.states.length > 1000000
  )
    throw Error("invalid");
  if (
    (v.found && (v.path.length === 0 || v.pathCost === null)) ||
    (!v.found && (v.path.length > 0 || v.pathCost !== null))
  )
    throw Error("invalid");
  const validState = (s: unknown) => {
    const e = r.config.environment;
    if (e.kind === "maze")
      return (
        Number.isInteger(s) &&
        Number(s) >= 0 &&
        Number(s) < e.rows * e.cols &&
        !e.walls.includes(Number(s))
      );
    if (e.kind === "graph")
      return typeof s === "string" && e.nodes.some((n) => n.id === s);
    return (
      Array.isArray(s) &&
      s.length === 9 &&
      new Set(s).size === 9 &&
      s.every((n) => Number.isInteger(n) && n >= 0 && n <= 8)
    );
  };
  if (
    !v.states.every(validState) ||
    !v.path.every(validState) ||
    !v.thresholds.every((n) => Number.isFinite(n) && n >= 0)
  )
    throw Error("invalid");
  const validId = (n: number) =>
    Number.isInteger(n) && n >= 0 && n < v.occurrences.length;
  if (
    v.occurrences.some(
      (o, i) =>
        o.id !== i ||
        !Number.isInteger(o.stateId) ||
        o.stateId < 0 ||
        o.stateId >= v.states.length ||
        !(
          o.parent === null ||
          (Number.isInteger(o.parent) && o.parent >= 0 && o.parent < i)
        ) ||
        ![o.g, o.h, o.priority, o.depth, o.iteration].every(
          (n) => Number.isFinite(n) && n >= 0,
        ),
    ) ||
    v.pathOccurrences.some((n) => !validId(n)) ||
    v.events.some(
      (e, i) =>
        e.index !== i ||
        !validId(e.occurrence) ||
        (e.targetStateId !== undefined &&
          (!Number.isInteger(e.targetStateId) ||
            e.targetStateId < 0 ||
            e.targetStateId >= v.states.length)) ||
        (e.candidateG !== undefined &&
          (!Number.isFinite(e.candidateG) || e.candidateG < 0)) ||
        ![
          "initialize",
          "push",
          "pop",
          "skip-stale",
          "expand",
          "discover",
          "relax",
          "reject",
          "goal",
          "iteration-start",
          "iteration-end",
          "backtrack",
          "terminate",
        ].includes(e.type) ||
        ![e.frontier, e.expanded, e.generated].every(
          (n) => Number.isInteger(n) && n >= 0,
        ),
    )
  )
    throw Error("invalid");
  if (
    (r.traceIncluded &&
      (!v.events.length ||
        v.events.at(-1)?.type !== "terminate" ||
        v.events.at(-1)?.reason !== v.terminationReason)) ||
    (!r.traceIncluded &&
      (v.events.length || v.occurrences.length || v.states.length))
  )
    throw Error("invalid");
  const problem = makeProblem(r.config.environment, r.config.zeroHeuristic);
  if (v.found) {
    if (
      problem.key(v.path[0]) !== problem.key(problem.start) ||
      !problem.goal(v.path.at(-1)!)
    )
      throw Error("invalid");
    for (let i = 1; i < v.path.length; i++)
      if (
        !problem
          .neighbors(v.path[i - 1])
          .some((a) => problem.key(a.state) === problem.key(v.path[i]))
      )
        throw Error("invalid");
  }
  if (r.traceIncluded) {
    const last = v.events.at(-1)!;
    if (
      v.events[0].type !== "initialize" ||
      last.expanded !== v.expandedNodes ||
      last.generated !== v.generatedNodes ||
      last.frontier !== v.finalFrontierSize ||
      v.occurrences.length !== v.generatedNodes ||
      v.events.filter((e) => e.type === "expand").length !== v.expandedNodes ||
      v.pathOccurrences.length !== v.path.length
    )
      throw Error("invalid");
    for (let i = 0; i < v.pathOccurrences.length; i++) {
      const o = v.occurrences[v.pathOccurrences[i]];
      if (
        problem.key(v.states[o.stateId]) !== problem.key(v.path[i]) ||
        o.parent !== (i === 0 ? null : v.pathOccurrences[i - 1])
      )
        throw Error("invalid");
      if (i === 0 && o.g !== 0) throw Error("invalid");
      if (i > 0) {
        const parent = v.occurrences[v.pathOccurrences[i - 1]];
        if (
          !problem
            .neighbors(v.path[i - 1])
            .some(
              (a) =>
                problem.key(a.state) === problem.key(v.path[i]) &&
                Math.abs(a.cost - (o.g - parent.g)) < 1e-8,
            )
        )
          throw Error("invalid");
      }
    }
    if (
      v.found &&
      Math.abs(v.occurrences[v.pathOccurrences.at(-1)!].g - v.pathCost!) > 1e-8
    )
      throw Error("invalid");
  }
}
