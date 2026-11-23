import { Heap } from "./heap";
import { makeProblem } from "../environments";
import {
  algorithms,
  type ExperimentConfig,
  type SearchResult,
  type State,
  type Occurrence,
  type SearchEvent,
  type EventType,
  type Termination,
} from "./types";
export interface Control {
  cancelled: boolean;
  elapsedMs: number;
  trace?: {
    states: State[];
    occurrences: Occurrence[];
    events: SearchEvent[];
    thresholds: number[];
  };
}
export function validateConfig(
  value: unknown,
): asserts value is ExperimentConfig {
  const c = value as ExperimentConfig;
  if (
    !c ||
    !algorithms.includes(c.algorithm) ||
    typeof c.seed !== "string" ||
    c.seed.length > 1000 ||
    !Number.isInteger(c.shuffleMoves) ||
    c.shuffleMoves < 0 ||
    c.shuffleMoves > 10000 ||
    typeof c.zeroHeuristic !== "boolean" ||
    !c.limits ||
    ![
      c.limits.expanded,
      c.limits.generated,
      c.limits.events,
      c.limits.durationMs,
    ].every((n) => Number.isSafeInteger(n) && n > 0) ||
    c.limits.events < 8 ||
    c.limits.events > 2000000 ||
    c.limits.generated > 1000000 ||
    c.limits.expanded > 1000000 ||
    c.limits.durationMs > 600000
  )
    throw Error("invalid");
  makeProblem(c.environment);
}
/** Resumable UI-independent execution. Each yield is a safe worker scheduling boundary. */
export function* search(
  c: ExperimentConfig,
  control: Control = { cancelled: false, elapsedMs: 0 },
): Generator<void, SearchResult> {
  validateConfig(c);
  const p = makeProblem(c.environment, c.zeroHeuristic||['dijkstra','bfs','dfs'].includes(c.algorithm)),
    states: State[] = [],
    ids = new Map<string, number>(),
    occurrences: Occurrence[] = [],
    events: SearchEvent[] = [],
    thresholds: number[] = [];
  control.trace = { states, occurrences, events, thresholds };
  let expanded = 0,
    generated = 0,
    repeated = 0,
    maxDepth = 0,
    maxFrontier = 0,
    maxPhysical = 0,
    frontier = 0,
    physical = 0,
    iteration = 0;
  const best = new Map<string, number>(),
    seen = new Set<string>(),
    active = new Map<string, number>();
  const priority = (g: number, h: number) =>
    c.algorithm === "greedy" ? h : c.algorithm === "dijkstra" ? g : g + h;
  const occurrence = (s: State, parent: Occurrence | null, g: number) => {
    const k = p.key(s);
    let sid = ids.get(k);
    if (sid === undefined) {
      sid = states.length;
      ids.set(k, sid);
      states.push(Array.isArray(s) ? [...s] : s);
    } else repeated++;
    const h = p.heuristic(s),
      o: Occurrence = {
        id: occurrences.length,
        stateId: sid,
        parent: parent?.id ?? null,
        g,
        h,
        priority: priority(g, h),
        depth: parent ? parent.depth + 1 : 0,
        iteration,
      };
    if (![g, h, o.priority].every(Number.isFinite)) throw Error("invalid");
    occurrences.push(o);
    maxDepth = Math.max(maxDepth, o.depth);
    return o;
  };
  const emit = (
    type: EventType,
    o: Occurrence,
    reason?: string,
    threshold?: number,
    targetStateId?: number,
    candidateG?: number,
  ) => {
    events.push({
      index: events.length,
      type,
      occurrence: o.id,
      frontier,
      expanded,
      generated,
      reason,
      threshold,
      targetStateId,
      candidateG,
    });
    maxFrontier = Math.max(maxFrontier, frontier);
    maxPhysical = Math.max(maxPhysical, physical);
  };
  const guard = (
    slots = 1,
    expanding = false,
    generating = false,
  ): Termination | null =>
    control.cancelled
      ? "cancelled"
      : control.elapsedMs >= c.limits.durationMs ||
          events.length + slots + 1 > c.limits.events ||
          (expanding && expanded >= c.limits.expanded) ||
          (generating && generated >= c.limits.generated)
        ? "limit-reached"
        : null;
  const finish = (reason: Termination, o: Occurrence): SearchResult => {
    emit("terminate", o, reason);
    const chain: number[] = [];
    if (reason === "goal-found") {
      let cursor: Occurrence | undefined = o;
      while (cursor) {
        chain.push(cursor.id);
        cursor =
          cursor.parent === null ? undefined : occurrences[cursor.parent];
      }
      chain.reverse();
    }
    return {
      found: reason === "goal-found",
      path: chain.map((i) => states[occurrences[i].stateId]),
      pathOccurrences: chain,
      pathCost: reason === "goal-found" ? o.g : null,
      expandedNodes: expanded,
      generatedNodes: generated,
      maxFrontierSize: maxFrontier,
      finalFrontierSize: frontier,
      maxPhysicalFrontier: maxPhysical,
      maxDepth,
      repeatedStates: repeated,
      elapsedMs: control.elapsedMs,
      workingMemoryBytes:
        (c.algorithm === "ida" ? 0 : ids.size * 32) +
        (c.algorithm === "ida"
          ? maxDepth * 32
          : best.size * 40 + seen.size * 24) +
        maxPhysical * 48,
      traceBytes:
        states.reduce<number>((n, s) => n + JSON.stringify(s).length * 2, 0) +
        occurrences.length * 64 +
        events.length * 56,
      terminationReason: reason,
      states,
      occurrences,
      events,
      thresholds,
    };
  };
  let root = occurrence(p.start, null, 0);
  generated = 1;
  frontier = 1;
  physical = 1;
  emit("initialize", root);
  yield;
  if (c.algorithm === "ida") {
    let threshold = root.h;
    const pathKeys = new Set<string>();
    type Frame = {
      o: Occurrence;
      entered: boolean;
      neighbors: { state: State; cost: number }[];
      index: number;
    };
    while (true) {
      thresholds.push(threshold);
      let exceeded = Infinity;
      const stop = guard(2, false, iteration > 0);
      if (stop) return finish(stop, root);
      if (iteration > 0) {
        root = occurrence(p.start, null, 0);
        generated++;
      }
      const stack: Frame[] = [
        { o: root, entered: false, neighbors: [], index: 0 },
      ];
      pathKeys.clear();
      pathKeys.add(p.key(p.start));
      frontier = 1;
      physical = 1;
      emit("iteration-start", root, undefined, threshold);
      yield;
      while (stack.length) {
        const frame = stack[stack.length - 1],
          o = frame.o,
          state = states[o.stateId];
        let stop = guard(2);
        if (stop) return finish(stop, o);
        if (!frame.entered) {
          frame.entered = true;
          if (o.priority > threshold) {
            exceeded = Math.min(exceeded, o.priority);
            emit("reject", o, "threshold", threshold);
            pathKeys.delete(p.key(state));
            stack.pop();
            frontier = physical = stack.length;
            emit("backtrack", o);
            yield;
            continue;
          }
          if (p.goal(state)) {
            emit("goal", o);
            return finish("goal-found", o);
          }
          stop = guard(1, true);
          if (stop) return finish(stop, o);
          expanded++;
          frame.neighbors = p.neighbors(state);
          emit("expand", o);
          yield;
          continue;
        }
        if (frame.index >= frame.neighbors.length) {
          pathKeys.delete(p.key(state));
          stack.pop();
          frontier = physical = stack.length;
          emit("backtrack", o);
          yield;
          continue;
        }
        const n = frame.neighbors[frame.index++];
        if (pathKeys.has(p.key(n.state))) {
          emit(
            "reject",
            o,
            "cycle",
            undefined,
            ids.get(p.key(n.state)),
            o.g + n.cost,
          );
          yield;
          continue;
        }
        stop = guard(1, false, true);
        if (stop) return finish(stop, o);
        const child = occurrence(n.state, o, o.g + n.cost);
        generated++;
        stack.push({ o: child, entered: false, neighbors: [], index: 0 });
        pathKeys.add(p.key(n.state));
        frontier = physical = stack.length;
        emit("discover", child);
        yield;
      }
      const endStop = guard(1);
      if (endStop) return finish(endStop, root);
      emit("iteration-end", root, undefined, threshold);
      yield;
      if (exceeded === Infinity) return finish("no-path", root);
      threshold = exceeded;
      iteration++;
    }
  }
  const heap = new Heap<Occurrence>(
    (a, b) =>
      a.priority < b.priority ||
      (a.priority === b.priority &&
        (a.id < b.id || (a.id === b.id && a.g < b.g))),
  );
  const queue: Occurrence[] = [];
  let head = 0;
  const stack: Occurrence[] = [];
  const isPriority = ["astar", "dijkstra", "greedy"].includes(c.algorithm);
  function push(o: Occurrence) {
    if (isPriority) heap.push(o);
    else if (c.algorithm === "bfs") queue.push(o);
    else stack.push(o);
    const k = p.key(states[o.stateId]);
    active.set(k, o.id);
    frontier = active.size;
    physical = isPriority
      ? heap.size
      : c.algorithm === "bfs"
        ? queue.length - head
        : stack.length;
  }
  function pop() {
    const o = isPriority
      ? heap.pop()!
      : c.algorithm === "bfs"
        ? queue[head++]
        : stack.pop()!;
    const k = p.key(states[o.stateId]);
    if (active.get(k) === o.id) active.delete(k);
    frontier = active.size;
    physical = isPriority
      ? heap.size
      : c.algorithm === "bfs"
        ? queue.length - head
        : stack.length;
    return o;
  }
  best.set(p.key(p.start), 0);
  seen.add(p.key(p.start));
  push(root);
  emit("push", root);
  yield;
  let last = root;
  while (physical) {
    let stop = guard(3);
    if (stop) return finish(stop, last);
    const o = pop();
    last = o;
    const state = states[o.stateId];
    emit("pop", o);
    yield;
    stop = guard(2);
    if (stop) return finish(stop, o);
    if (isPriority && o.g !== best.get(p.key(state))) {
      emit("skip-stale", o);
      yield;
      continue;
    }
    if (p.goal(state)) {
      emit("goal", o);
      return finish("goal-found", o);
    }
    stop = guard(1, true);
    if (stop) return finish(stop, o);
    expanded++;
    emit("expand", o);
    yield;
    const ns = p.neighbors(state);
    if (c.algorithm === "dfs") ns.reverse();
    for (const n of ns) {
      stop = guard(2);
      if (stop) return finish(stop, o);
      const k = p.key(n.state),
        g = o.g + n.cost,
        old = best.get(k);
      if (!Number.isFinite(g)) throw Error("invalid");
      if (isPriority ? g >= (old ?? Infinity) : seen.has(k)) {
        emit("reject", o, "not-improved", undefined, ids.get(k), g);
        yield;
        continue;
      }
      stop = guard(2, false, true);
      if (stop) return finish(stop, o);
      const child = occurrence(n.state, o, g);
      generated++;
      best.set(k, g);
      seen.add(k);
      push(child);
      emit(old === undefined ? "discover" : "relax", child);
      emit("push", child);
      yield;
    }
  }
  return finish("no-path", last);
}
/** Synchronous runner for deterministic tests and small reference experiments. */
export function runSearch(c: ExperimentConfig) {
  const control = { cancelled: false, elapsedMs: 0 },
    g = search(c, control),
    start = performance.now();
  let step = g.next();
  while (!step.done) {
    control.elapsedMs = performance.now() - start;
    step = g.next();
  }
  return step.value;
}
