import type { AccentColor } from "./types";

/**
 * Selectable accent hues. The palette itself lives in `globals.css` under
 * `[data-accent="…"]`; this is only the order and the accessible names, so the
 * picker never hardcodes a second copy of the colour values.
 */
export const ACCENTS: ReadonlyArray<{ id: AccentColor; label: string }> = [
  { id: "red", label: "Red" },
  { id: "orange", label: "Orange" },
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "purple", label: "Purple" },
  { id: "pink", label: "Pink" },
];

export const ACCENT_IDS = ACCENTS.map((accent) => accent.id);

export const DEFAULT_ACCENT: AccentColor = "orange";
