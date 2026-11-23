import { expect, it } from "vitest";
import { Timeline } from "./index";
import { runSearch } from "../engine/search";
import { initialConfig } from "../environments";
it("backward and forward reconstruction equals a fresh replay", () => {
  const r = runSearch(initialConfig()),
    t = new Timeline(r);
  for (const i of [100, 2, r.events.length - 1, 10, 200, 0])
    expect(t.at(i)).toEqual(new Timeline(r).at(i));
});
