import { ReactNode } from "react";

export const metadata = {
  title: "KRISHOE Factory Management",
  description: "Daily work tracking and payroll system for KRISHOE slippers factory",
};

export default function FactoryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <nav className="bg-white border-b lg:border-r border-slate-200 lg:w-56 shrink-0">
        <div className="p-4">
          <h2 className="text-lg font-bold text-slate-900">KRISHOE Factory</h2>
        </div>
        <ul className="space-y-1 px-2">
          <li>
            <a
              href="/admin/factory"
              className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              📊 Dashboard
            </a>
          </li>
          <li>
            <a
              href="/admin/factory/add-work"
              className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              ➕ Add Work
            </a>
          </li>
          <li>
            <a
              href="/admin/factory/workers"
              className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              👥 Workers
            </a>
          </li>
          <li>
            <a
              href="/admin/factory/ledger"
              className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              📋 Ledger
            </a>
          </li>
          <li>
            <a
              href="/admin/factory/reports"
              className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              📈 Reports
            </a>
          </li>
          <li>
            <a
              href="/admin/factory/salary"
              className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Monthly Staff Salary
            </a>
          </li>
        </ul>
      </nav>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
