"use client";

import { useState, useRef, useEffect } from "react";
import { SearchIcon } from "@/components/Icons";

type Worker = {
  id: string;
  name: string;
  position: string;
  phone?: string;
};

type WorkerSearchSelectProps = {
  workers: Worker[];
  selectedId?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
};

export default function WorkerSearchSelect({
  workers,
  selectedId,
  onChange,
  placeholder = "Search worker by name or phone...",
  required = false,
}: WorkerSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = workers.find((w) => w.id === selectedId);
  const filtered = workers.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.phone?.includes(search) ||
    w.position.toLowerCase().includes(search.toLowerCase())
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
      <input type="hidden" name="employeeId" value={selectedId || ""} />

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
          {selected ? (
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{selected.name}</span>
              <span className="text-xs text-gray-500">{selected.position}</span>
            </div>
          ) : (
            placeholder
          )}
        </span>
        <SearchIcon className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-lg">
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
            {filtered.length > 0 ? (
              <div className="space-y-1 p-2">
                {filtered.map((worker) => (
                  <button
                    key={worker.id}
                    type="button"
                    onClick={() => {
                      onChange(worker.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      selectedId === worker.id
                        ? "bg-brand-green-tint text-brand-green font-semibold"
                        : "hover:bg-gray-50 text-brand-green-ink"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{worker.name}</p>
                        <p className="text-xs text-gray-500">{worker.position}</p>
                      </div>
                      {worker.phone && (
                        <span className="text-xs text-gray-400 ml-2">{worker.phone}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                No workers found matching &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}

      {required && !selectedId && (
        <p className="mt-1 text-xs text-red-600">Worker selection is required</p>
      )}
    </div>
  );
}
