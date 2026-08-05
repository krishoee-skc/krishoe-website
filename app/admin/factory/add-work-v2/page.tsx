"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SimplifiedAddWork from "@/components/admin/SimplifiedAddWork";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";

interface Worker {
  id: string;
  name: string;
  category: string;
  worker_type: string;
  todayPairs?: number;
}

interface Product {
  id: string;
  name: string;
  rate?: number;
}

interface WorkEntry {
  date: string;
  workerId: string;
  productId: string;
  pairs: number;
  status: "in-progress" | "completed" | "rework";
}

export default function AddWorkV2Page() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());

  useEffect(() => {
    const loadData = async () => {
      try {
        const [workersRes, itemsRes] = await Promise.all([
          fetch("/api/factory/workers"),
          fetch("/api/factory/items"),
        ]);

        const workersData = await workersRes.json();
        const itemsData = await itemsRes.json();

        // Filter piece-rate workers
        const pieceRateWorkers = (workersData.workers || [])
          .filter((w: Worker) => w.worker_type === "piece_rate")
          .map((w: Worker) => ({
            ...w,
            todayPairs: Math.floor(Math.random() * 100), // Placeholder - should fetch from DB
          }));

        setWorkers(pieceRateWorkers);
        setProducts(
          (itemsData.items || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            rate: 12, // Placeholder - should fetch actual rate
          }))
        );
      } catch (err) {
        setError("Failed to load workers and products");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSubmit = async (entry: WorkEntry) => {
    try {
      // Convert to format expected by backend
      const formData = {
        date: entry.date,
        worker_id: entry.workerId,
        item_id: entry.productId,
        work_order_id: "",
        color: "",
        size: "",
        pairs_count: entry.pairs.toString(),
        status: entry.status === "completed" ? "completed" : "in-progress",
      };

      const keyScope = `work:${JSON.stringify(formData)}`;
      const res = await fetch("/api/factory/work", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeys.get(keyScope),
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save work entry");
      }

      idempotencyKeys.rotate(keyScope);

      // After successful submission, stay on page to add more entries
      // User will navigate manually when done
    } catch (err) {
      throw err;
    }
  };

  const handleCancel = () => {
    router.push("/admin/factory");
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="animate-pulse text-gray-500">Loading workers and products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <SimplifiedAddWork
      workers={workers}
      products={products}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );
}
