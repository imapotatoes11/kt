/**
 * Shared Tailwind class recipes.
 *
 * These are the handful of UI primitives that repeat across every view. Keeping
 * the utility strings in one place avoids drift between, say, the four different
 * places a panel header is rendered. Anything used once lives inline in the JSX.
 */

export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

// One `border-color` utility per variant — Tailwind gives no reliable source
// order between `border-transparent` and a coloured `border-*`, so the base
// deliberately leaves the colour to each variant.
const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-input border px-[13px] py-2 text-[0.82rem] font-[590] no-underline transition-[background-color,border-color,color,box-shadow] duration-[140ms] ease-out disabled:cursor-not-allowed disabled:opacity-[0.48]";

export const button = {
  base: buttonBase,
  primary: cx(
    buttonBase,
    "border-ink bg-ink text-surface enabled:hover:border-accent enabled:hover:bg-accent enabled:hover:text-white",
  ),
  secondary: cx(
    buttonBase,
    "border-line-strong bg-surface enabled:hover:border-faint enabled:hover:bg-surface-strong",
  ),
  quiet: cx(
    buttonBase,
    "border-transparent bg-transparent text-muted hover:border-transparent hover:bg-surface-strong hover:text-ink",
  ),
  small: "min-h-[34px] px-2.5 py-1.5",
  wide: "w-full min-h-[46px]",
};

export const textButton =
  "min-h-9 border-0 bg-transparent px-0 py-1.5 text-[0.78rem] font-semibold text-accent-ink hover:text-accent-hover";

// The label is wrapped in <span className={pageSaveLabel}> so it can be hidden
// on the narrowest screens — torph sets an inline `display` on its own node,
// which a utility on that node could not override.
export const pageSaveButton = cx(
  button.primary,
  "max-nav:min-w-11 max-xs:size-11 max-xs:min-w-11 max-xs:shrink-0 max-xs:p-0",
);
export const pageSaveLabel = "max-nav:inline-block max-nav:max-w-[112px] max-nav:overflow-hidden max-xs:hidden";

export const masterToggle =
  "flex min-h-[70px] items-center justify-between gap-4 border-b border-line px-4 py-3 [&>div]:flex [&>div]:items-center [&>div]:gap-[11px] [&>div>svg]:text-accent [&_span]:grid [&_small]:text-[0.69rem] [&_small]:text-muted";

export const iconButton =
  "inline-grid size-[38px] shrink-0 place-items-center rounded-input border-0 bg-transparent text-muted hover:bg-surface-strong hover:text-ink";

export const iconButtonDanger =
  "inline-grid size-[38px] shrink-0 place-items-center rounded-input border-0 bg-transparent text-muted hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-danger";

export const panel = "rounded-card border border-line bg-surface";

export const panelHeader =
  "flex min-h-[62px] items-center justify-between gap-4 border-b border-line px-4 py-3.5 [&>svg]:text-faint";

// Same conflicting-utility trap as the buttons above: the connected variant
// must be a complete recipe, not colour utilities layered onto `badge`.
const badgeBase =
  "inline-flex items-center rounded-md border px-2 py-[3px] text-[0.69rem] font-semibold";

export const badge = cx(badgeBase, "border-line bg-surface-subtle text-muted");

export const badgeConnected = cx(
  badgeBase,
  "border-[color-mix(in_srgb,var(--success)_30%,var(--line))] bg-[color-mix(in_srgb,var(--success)_8%,var(--surface))] text-success",
);

export const field = "grid min-w-0 content-start gap-1.5";
export const fieldLabel = "text-[0.75rem] font-[590] text-ink [&_span]:float-right [&_span]:font-normal [&_span]:text-faint";
export const fieldSpan2 = "col-span-full max-xs:col-auto";

const statusBadgeBase =
  "w-fit rounded-md border px-2 py-[3px] text-[0.68rem] font-[650] capitalize";
export const statusBadge = {
  base: statusBadgeBase,
  changed: cx(statusBadgeBase, "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]"),
  cancelled: cx(statusBadgeBase, "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"),
};

export const pageStack = "mx-auto grid max-w-[1420px] gap-5 max-nav:gap-3.5";
export const pageHeading =
  "flex min-h-16 items-end justify-between gap-6 max-nav:min-h-11 max-nav:items-center";
export const pageHeadingActions =
  "flex min-h-16 items-center justify-between gap-6 max-nav:min-h-11 max-nav:items-end max-xs:items-center max-xs:[&>div]:min-w-0";
export const pageDescription = "mt-2 max-w-[64ch] text-[0.91rem] text-muted";

export const emptyState =
  "grid justify-items-center px-6 py-[60px] text-center text-muted [&_h2]:mb-[5px] [&_h2]:text-ink [&_h3]:mb-[5px] [&_h3]:text-[1.17em] [&_h3]:font-bold [&_h3]:text-ink [&_p]:max-w-[40ch] [&_p]:text-[0.8rem] [&>svg]:mb-3 [&>svg]:size-7 [&>svg]:text-faint";
export const compactEmpty = "px-4 py-7 text-[0.77rem] text-faint";

export const statePage =
  "grid min-h-[100dvh] content-center place-items-center gap-2.5 p-6 text-center [&>svg]:size-[34px] [&>svg]:text-accent";
