const PALETTE = [
  "#F5A623",
  "#4DADD9",
  "#22A36B",
  "#7C5CBF",
  "#E67E22",
  "#E53935",
  "#00897B",
  "#5C6BC0",
] as const;

/** Stable color per specialty/profession label for admin maps. */
export function specialtyColor(key: string | null | undefined): string {
  if (!key?.trim()) return "#9CA3AF";
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? "#9CA3AF";
}
