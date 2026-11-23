import type {
  ExperimentConfig,
  SearchResult,
  SearchEvent,
  Occurrence,
  State,
} from "../engine/types";
export type Request =
  | { type: "start"; runId: string; config: ExperimentConfig }
  | { type: "pause" | "resume" | "cancel"; runId: string };
export type Response =
  | {
      type: "progress";
      runId: string;
      steps: number;
      states: State[];
      occurrences: Occurrence[];
      events: SearchEvent[];
      elapsedMs: number;
    }
  | { type: "complete"; runId: string; result: SearchResult }
  | { type: "failure"; runId: string; error: string };
