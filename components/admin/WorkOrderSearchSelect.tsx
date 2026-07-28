"use client";

import { useState, useRef, useEffect } from "react";
import { SearchIcon } from "@/components/Icons";

type WorkOrder = {
  id: string;
  label: string;
};

type WorkOrderSearchSelectProps = {
  workOrders: WorkOrder[];
  selectedId?: string;
  onChange: (id: string) => void;
  placeholder?: string;
};

export default function WorkOrderSearchSelect({
  workOrders,
  selectedId,
  onChange,
  placeholder = "Search work order by design or ID...",
}: WorkOrderSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = workOrders.find((w) => w.id === selectedId);
  const filtered = workOrders.filter((w) =>
    w.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <input type="hidden" name="workOrderId" value={selectedId || ""} />

      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm text-brand-green-ink outline-none focus:border-brand-green transition flex items-center justify-between"
      >
        <span className={selected ? "font-medium" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <SearchIcon className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-lg sm:col-span-2">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand-green"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
                setSearch("");
              }}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                !selectedId ? "bg-brand-green-tint text-brand-green font-semibold" : "hover:bg-gray-50"
              }`}
            >
              No Work Order link (manual entry)
            </button>

            {filtered.length > 0 ? (
              <div className="space-y-1 p-2">
                {filtered.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      onChange(order.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      selectedId === order.id
                        ? "bg-brand-green-tint text-brand-green font-semibold"
                        : "hover:bg-gray-50 text-brand-green-ink"
                    }`}
                  >
                    {order.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                No work orders found matching "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
