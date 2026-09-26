import { redirect } from "next/navigation";

/**
 * A Work Order's tracking page used to live here, with its QR sheet.
 *
 * The owner took Work Orders out — none was ever made — so the page is gone.
 * An old bookmark or a printed QR lands on Operations instead of an error.
 * The Work Order tables stay in the database, untouched.
 */
export default function RetiredWorkOrderPage() {
  redirect("/admin/operations");
}
