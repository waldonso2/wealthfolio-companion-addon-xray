// Entry of the addon (Wealthfolio ≥ 3.11): a sidebar item and one route whose component the host mounts in its own
// React root. The SDK is not bundled: ctx is typed by what is used (structural, see Ctx).
import type { ComponentType } from "react";
import type { Storage } from "./contract";
import type { Api } from "./depot";
import { XRayPage } from "./XRayPage";
import "./addon.css";

export const ADDON = "broker-sync-xray";
const ROUTE = `/addons/${ADDON}`;

/** What the addon uses of Wealthfolio's AddonContext (@wealthfolio/addon-sdk). */
export interface Ctx {
  api: Api & { storage: Storage };
  sidebar: { addItem(item: { id: string; label: string; icon?: string; route: string; order?: number }): { remove(): void } };
  router: { add(route: { id: string; path: string; component: ComponentType }): void };
  onDisable(callback: () => void): void;
}

export default function enable(ctx: Ctx) {
  const item = ctx.sidebar.addItem({ id: ADDON, label: "X-Ray", icon: "chart-pie", route: ROUTE, order: 110 });
  const Page = () => <XRayPage storage={ctx.api.storage} api={ctx.api} />;
  ctx.router.add({ id: ADDON, path: ROUTE, component: Page });
  ctx.onDisable(() => item.remove());
}
