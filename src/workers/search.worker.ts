import { search, type Control } from "../engine/search";
import type { SearchResult } from "../engine/types";
import type { Request, Response } from "./protocol";
let job: {
  id: string;
  iterator: Generator<void, SearchResult>;
  control: Control;
  paused: boolean;
  steps: number;
  sent: [number, number, number];
  lastSent: number;
} | null = null;
let scheduled = false;
const send = (message: Response) => postMessage(message);
function schedule() {
  if (!scheduled) {
    scheduled = true;
    setTimeout(tick, 0);
  }
}
function tick() {
  scheduled = false;
  const current = job;
  if (!current || current.paused) return;
  const start = performance.now();
  try {
    for (let i = 0; i < 1000; i++) {
      const t = performance.now();
      const step = current.iterator.next();
      current.control.elapsedMs += performance.now() - t;
      current.steps++;
      if (step.done) {
        step.value.elapsedMs = current.control.elapsedMs;
        send({ type: "complete", runId: current.id, result: step.value });
        job = null;
        return;
      }
      if (performance.now() - start > 8) break;
    }
    if (performance.now() - current.lastSent > 150 && current.control.trace) {
      const trace = current.control.trace;
      send({
        type: "progress",
        runId: current.id,
        steps: current.steps,
        states: trace.states.slice(current.sent[0]),
        occurrences: trace.occurrences.slice(current.sent[1]),
        events: trace.events.slice(current.sent[2]),
        elapsedMs: current.control.elapsedMs,
      });
      current.sent = [
        trace.states.length,
        trace.occurrences.length,
        trace.events.length,
      ];
      current.lastSent = performance.now();
    }
    schedule();
  } catch (error) {
    send({
      type: "failure",
      runId: current.id,
      error: error instanceof Error ? error.message : "worker",
    });
    job = null;
  }
}
self.onmessage = (event: MessageEvent<Request>) => {
  const m = event.data;
  if (m.type === "start") {
    const control: Control = { cancelled: false, elapsedMs: 0 };
    job = {
      id: m.runId,
      iterator: search(m.config, control),
      control,
      paused: false,
      steps: 0,
      sent: [0, 0, 0],
      lastSent: 0,
    };
    schedule();
  } else if (job?.id === m.runId) {
    if (m.type === "pause") job.paused = true;
    if (m.type === "resume") {
      job.paused = false;
      schedule();
    }
    if (m.type === "cancel") {
      job.control.cancelled = true;
      job.paused = false;
      schedule();
    }
  }
};
