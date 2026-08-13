import { redirect } from "next/navigation";

// The original simplified form had a separate validation path and could drift
// from the production-aware work-order workflow. Keep old bookmarks working,
// but send every work entry through the single canonical screen.
export default function LegacyAddWorkV2Page() {
  redirect("/admin/factory/add-work");
}
