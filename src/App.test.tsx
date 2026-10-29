// Components in jsdom with axe-core (no violation; contrast needs a real layout - e2e/ui.spec.ts checks it).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { wordCounts } from "./words";

afterEach(cleanup);

async function expectAccessible(container: HTMLElement) {
  const { violations } = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

describe("wordCounts", () => {
  it("counts by frequency, then alphabetically", () => {
    expect(wordCounts("b a, B! c a b")).toEqual([
      ["b", 3],
      ["a", 2],
      ["c", 1],
    ]);
  });
  it("sorts words of the same count alphabetically", () => {
    expect(wordCounts("z a")).toEqual([
      ["a", 1],
      ["z", 1],
    ]);
  });
  it("ignores punctuation only", () => {
    expect(wordCounts("... !!")).toEqual([]);
  });
});

describe("App", () => {
  it("shows the words typed, and is accessible", async () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "x y x" } });
    expect(screen.getAllByRole("row")).toHaveLength(3);
    await expectAccessible(container);
  });
});
