import { cx } from "./ui";

/**
 * The TT mark: three schedule columns, drawn with the same rounded blocks the gap
 * timeline uses. The middle column is split by a gap — the thing the app is
 * actually for — and the third block carries the accent, so the mark re-colours
 * with the user's chosen accent like the rest of the UI.
 *
 * Geometry is shared with `public/icon-maskable.svg` and `src/app/icon.svg`;
 * change all three together.
 */
export function BrandMark({ size = "large" }: { size?: "large" | "small" | "mini" }) {
  return (
    <span
      className={cx("brand-mark", size === "small" && "brand-mark-small", size === "mini" && "brand-mark-mini")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <rect width="48" height="48" rx="11" fill="var(--ink)" />
        <rect x="9.5" y="13" width="7" height="22" rx="3.5" fill="var(--surface)" />
        <rect x="20.5" y="9" width="7" height="12" rx="3.5" fill="var(--surface)" />
        <rect x="20.5" y="27" width="7" height="12" rx="3.5" fill="var(--surface)" />
        <rect x="31.5" y="17" width="7" height="18" rx="3.5" fill="var(--accent)" />
      </svg>
    </span>
  );
}
