export const factoryOfflineDraftStorageKey =
  "krishoe.factory.production-drafts.v1";

export type FactoryOfflineProductionDraft = {
  id: string;
  assignmentId: string;
  createdAt: string;
  remarks: string;
  sizes: Array<{
    size: string;
    goodPairs: number;
    rejectPairs: number;
    reworkPairs: number;
  }>;
};

function whole(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function normalizeFactoryOfflineDraft(
  value: FactoryOfflineProductionDraft,
): FactoryOfflineProductionDraft {
  const sizes = value.sizes
    .map((row) => ({
      size: row.size.trim().slice(0, 30),
      goodPairs: whole(row.goodPairs),
      rejectPairs: whole(row.rejectPairs),
      reworkPairs: whole(row.reworkPairs),
    }))
    .filter(
      (row) =>
        row.size &&
        row.goodPairs + row.rejectPairs + row.reworkPairs > 0,
    );
  if (!value.id.trim() || !value.assignmentId.trim() || sizes.length === 0) {
    throw new Error("Offline production draft is incomplete.");
  }
  return {
    id: value.id.trim(),
    assignmentId: value.assignmentId.trim(),
    createdAt: new Date(value.createdAt).toISOString(),
    remarks: value.remarks.trim().slice(0, 500),
    sizes,
  };
}

export function parseFactoryOfflineDrafts(raw: string | null) {
  if (!raw) return [];
  try {
    const values = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const seen = new Set<string>();
    return values.slice(0, 100).flatMap((value) => {
      try {
        const draft = normalizeFactoryOfflineDraft(value);
        if (seen.has(draft.id)) return [];
        seen.add(draft.id);
        return [draft];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
