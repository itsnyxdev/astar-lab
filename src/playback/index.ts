import type { SearchTrace, SearchEvent } from "../engine/types";
export interface Playback {
  index: number;
  current: number | null;
  frontier: Set<number>;
  expanded: Set<number>;
  parents: Map<number, number | null>;
  path: Set<number>;
}
const blank = (): Playback => ({
  index: -1,
  current: null,
  frontier: new Set(),
  expanded: new Set(),
  parents: new Map(),
  path: new Set(),
});
function clone(s: Playback): Playback {
  return {
    ...s,
    frontier: new Set(s.frontier),
    expanded: new Set(s.expanded),
    parents: new Map(s.parents),
    path: new Set(s.path),
  };
}
export function apply(s: Playback, e: SearchEvent, r: SearchTrace) {
  const o = r.occurrences[e.occurrence];
  s.index = e.index;
  s.current = o.stateId;
  if (["initialize", "discover", "relax", "iteration-start"].includes(e.type)) {
    if (e.type === "relax")
      for (const id of s.frontier)
        if (r.occurrences[id].stateId === o.stateId) s.frontier.delete(id);
    s.parents.set(o.id, o.parent);
    s.frontier.add(o.id);
  }
  if (["pop", "skip-stale", "backtrack"].includes(e.type))
    s.frontier.delete(o.id);
  if (e.type === "expand") s.expanded.add(o.stateId);
  if (e.type === "iteration-start") {
    s.frontier = new Set([o.id]);
    s.expanded.clear();
  }
  if (e.type === "goal") {
    let cursor: typeof o | undefined = o;
    while (cursor) {
      s.path.add(cursor.stateId);
      cursor =
        cursor.parent === null ? undefined : r.occurrences[cursor.parent];
    }
  }
  return s;
}
/** Bounded checkpoints; reconstruction always consumes authoritative recorded events. */
export class Timeline {
  private checkpoints = new Map<number, Playback>([[-1, blank()]]);
  private current = blank();
  constructor(readonly result: SearchTrace) {}
  at(index: number) {
    index = Math.max(-1, Math.min(index, this.result.events.length - 1));
    let base = this.current.index <= index ? this.current : blank();
    for (const [i, s] of this.checkpoints)
      if (i <= index && i > base.index) base = s;
    const s = clone(base);
    for (let i = s.index + 1; i <= index; i++) {
      apply(s, this.result.events[i], this.result);
      if (i % 1000 === 0) {
        this.checkpoints.set(i, clone(s));
        if (this.checkpoints.size > 24) {
          const k = [...this.checkpoints.keys()].find((k) => k !== -1);
          if (k !== undefined) this.checkpoints.delete(k);
        }
      }
    }
    this.current = s;
    return clone(s);
  }
}
