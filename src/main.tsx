// The harness page: the addon's page with fabricated demo data, so the browser test (e2e/ui.spec.ts) and the
// performance report check it without Wealthfolio. Not part of the addon (vite.config.ts builds src/addon.tsx).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { demo } from "./demo";
import { XRayPage } from "./XRayPage";
import "./addon.css";

const state = new URLSearchParams(location.search).get("state") ?? "";
demo(state).then(({ storage, api }) =>
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <XRayPage storage={storage} api={api} />
    </StrictMode>,
  ),
);
