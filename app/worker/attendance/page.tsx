import { redirect } from "next/navigation";

// The factory records pairs handed over, not clock-in times, so there is no
// attendance to show. Days worked are counted from the production entries and
// shown on the dashboard instead. Kept as a redirect rather than deleted so any
// link or bookmark already handed to a worker still lands somewhere useful.
export default function WorkerAttendancePage() {
  redirect("/worker/production");
}
