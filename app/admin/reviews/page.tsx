import { redirect } from "next/navigation";

/**
 * Moved into the one inbox.
 *
 * Reviews, Feedback and Messages were three screens over three different
 * stores — Feedback's table had never even been created — and answering a
 * customer meant opening all three and hoping none had been missed. The link
 * stays so that a bookmark, an older page, or a habit still arrives somewhere
 * useful rather than at a 404.
 */
export default function Page() {
  redirect("/admin/inbox?kind=review");
}
