// The page in jsdom with axe-core (contrast needs a real layout - e2e/ui.spec.ts checks it on the harness page).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import enable from "./addon";
import { INDEX, type Storage } from "./contract";
import { demo } from "./demo";
import { SETTINGS } from "./settings";
import { XRayPage } from "./XRayPage";

afterEach(() => {
  cleanup();
  document.documentElement.lang = "de";
});

async function expectAccessible(container: HTMLElement) {
  const { violations } = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

function openAll(container: HTMLElement) {
  container.querySelectorAll("details").forEach((d) => (d.open = true));
}

describe("XRayPage", () => {
  it("shows figures, matrix, overlap, funds, risks and settings, and is accessible", async () => {
    const { storage, api } = await demo("");
    const { container } = render(<XRayPage storage={storage} api={api} />);
    await screen.findByText("Kennzahlen");
    openAll(container);
    expect(screen.getByText("Gesamt: Aktien über alle Positionen")).toBeTruthy();
    expect(screen.getAllByText("Beispiel World UCITS ETF").length).toBeGreaterThan(1);
    expect(screen.getByText(/Für UBS gibt es keinen automatischen Abruf/)).toBeTruthy();
    expect(screen.getByText(/Noch ohne Liste/)).toBeTruthy();
    expect(screen.getAllByText(/TER unbekannt|unbekannt/).length).toBeGreaterThan(0);
    await expectAccessible(container);
  });

  it("shows all rows of the matrix on request and all lines of a fund", async () => {
    const { storage, api } = await demo("");
    const { container } = render(<XRayPage storage={storage} api={api} />);
    await screen.findByText("Kennzahlen");
    openAll(container);
    const matrix = () => container.querySelectorAll("table")[0].querySelectorAll("tbody tr").length;
    expect(matrix()).toBe(10);
    fireEvent.change(screen.getByLabelText("Zeigen"), { target: { value: "all" } });
    expect(matrix()).toBeGreaterThan(100);
    fireEvent.click(screen.getByRole("button", { name: "Alle 400 anzeigen" }));
    expect(screen.queryByRole("button", { name: "Alle 400 anzeigen" })).toBeNull();
  });

  it("accepts a cluster risk, takes it back and saves the limits", async () => {
    const { storage, api } = await demo("");
    const { container } = render(<XRayPage storage={storage} api={api} />);
    await screen.findByText("Kennzahlen");
    openAll(container);
    const before = screen.getAllByRole("button", { name: "Bewusst so" }).length;
    fireEvent.click(screen.getAllByRole("button", { name: "Bewusst so" })[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Bewusst so" }).length).toBe(before - 1));
    expect(JSON.parse((await storage.get(SETTINGS)) as string).accepted).toHaveLength(1);
    openAll(container);
    fireEvent.click(screen.getByRole("button", { name: "Wieder melden" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Bewusst so" }).length).toBe(before));
    fireEvent.change(screen.getByLabelText("Einzelaktie über (%)"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText(/Bitte eine Zahl/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Einzelaktie über (%)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await screen.findByText("Gespeichert.");
    expect(JSON.parse((await storage.get(SETTINGS)) as string).limits.stock).toBe("0.5");
    fireEvent.click(screen.getByRole("button", { name: "Zurück auf Standard" }));
    await waitFor(async () => expect(JSON.parse((await storage.get(SETTINGS)) as string).limits.stock).toBe("0.05"));
  });

  it("says when there is no data, newer data, no positions or Wealthfolio fails - in English too", async () => {
    document.documentElement.lang = "en";
    const { storage, api } = await demo("empty");
    render(<XRayPage storage={storage} api={api} />);
    expect(await screen.findByText(/No data yet/)).toBeTruthy();
    cleanup();
    const newer: Storage = { get: async (k) => (k === INDEX ? JSON.stringify({ schema: 9 }) : null), set: async () => {} };
    render(<XRayPage storage={newer} api={api} />);
    expect(await screen.findByText(/schema 9/)).toBeTruthy();
    cleanup();
    const full = await demo("");
    render(<XRayPage storage={full.storage} api={{ ...api, accounts: { getAll: async () => [] } }} />);
    expect(await screen.findByText("No positions in Wealthfolio.")).toBeTruthy();
    cleanup();
    render(<XRayPage storage={full.storage} api={{ ...api, accounts: { getAll: async () => Promise.reject(new Error("down")) } }} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/does not answer: down/);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("warns when the service has not written for over a week and names an error of its last fetch", async () => {
    const { storage, api } = await demo("");
    const index = JSON.parse((await storage.get(INDEX)) as string);
    index.written_at = "2026-01-01T00:00:00Z";
    index.last_pass = { at: "2026-01-01T00:00:00Z", error: "iShares: HTTP 503" };
    await storage.set(INDEX, JSON.stringify(index));
    render(<XRayPage storage={storage} api={api} />);
    expect(await screen.findByText(/seit über 8 Tagen/)).toBeTruthy();
    expect(screen.getByText(/iShares: HTTP 503/)).toBeTruthy();
  });
});

describe("enable", () => {
  it("adds the sidebar item and the route, and removes the item when disabled", async () => {
    const calls: string[] = [];
    let disable = () => {};
    let Page: () => unknown = () => null;
    const { storage, api } = await demo("");
    enable({
      api: { ...api, storage },
      sidebar: { addItem: (i) => (calls.push(`item ${i.route}`), { remove: () => calls.push("removed") }) },
      router: { add: (r) => (calls.push(`route ${r.path}`), (Page = r.component as () => unknown)) },
      onDisable: (cb) => (disable = cb),
    });
    expect(calls).toEqual(["item /addons/broker-sync-xray", "route /addons/broker-sync-xray"]);
    const P = Page as () => React.ReactElement;
    render(<P />);
    expect(await screen.findByText("Kennzahlen")).toBeTruthy();
    disable();
    expect(calls.at(-1)).toBe("removed");
  });
});
