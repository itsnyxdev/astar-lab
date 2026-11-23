import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Editor } from "./Editor";
import { LanguageContext } from "../i18n";
import { initialConfig, preset } from "../environments";
it("uses translated labels and validates custom puzzle input", () => {
  const change = vi.fn(),
    error = vi.fn();
  render(
    <LanguageContext.Provider value="en">
      <Editor
        config={{ ...initialConfig(), environment: preset("puzzle") }}
        change={change}
        tool="inspect"
        setTool={() => {}}
        onError={error}
      />
    </LanguageContext.Provider>,
  );
  fireEvent.change(screen.getByLabelText("Start tiles (0 = blank)"), {
    target: { value: "2 1 3 4 5 6 7 8 0" },
  });
  fireEvent.click(screen.getByText("Apply boards"));
  expect(error).toHaveBeenCalledWith("unsolvable");
  expect(change).not.toHaveBeenCalled();
  cleanup();
});
