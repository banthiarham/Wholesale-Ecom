import type { ReactNode } from "react"

/**
 * Shared status badge for admin pages.
 *
 * This centralizes the CSS *mechanism* used to color status pills — the
 * ad-hoc `bg-x-100 text-x-700 dark:bg-x-900/30 dark:text-x-400` class strings
 * that used to be copy-pasted (with small drifts) across 8 admin pages — into
 * the shared `.admin-badge-*` design tokens defined in globals.css.
 *
 * It intentionally does NOT try to own a universal "status -> color" mapping.
 * Different admin domains (orders vs payments vs RFQs vs returns vs role
 * requests) use overlapping-but-different status vocabularies, and — as
 * discovered while auditing the original files — the same status string can
 * even mean a different color in different files (e.g. "PROCESSING" is
 * purple in most files but blue in the orders page, "SHIPPED" is indigo in
 * most files but purple in the orders page). Forcing one shared map onto all
 * of them would silently change colors. So each call site keeps its own tiny
 * `status -> badge props` function, and only the rendering/color-token
 * mechanism is shared here.
 *
 * Only 5 color tokens exist today: neutral / primary / success / warning /
 * danger (see `.admin-badge-*` in globals.css). Several legacy statuses use
 * color families with no matching token — purple, indigo, orange, emerald.
 * For those, pass `colorClassName` with the exact original Tailwind color
 * classes instead of `variant`; this preserves the original color exactly
 * rather than mis-mapping it onto an unrelated token (e.g. forcing a purple
 * "PROCESSING" badge into the blue "primary" token would change its meaning).
 */

export type AdminBadgeVariant = "success" | "warning" | "danger" | "primary" | "neutral"

export interface AdminStatusBadgeProps {
  /** Raw status value, e.g. "PENDING". Also used as the displayed text unless `label` is set. */
  status: string
  /** One of the shared `.admin-badge-*` tokens. Ignored when `colorClassName` is set. Defaults to "neutral". */
  variant?: AdminBadgeVariant
  /**
   * Escape hatch for color families with no matching token (purple, indigo,
   * orange, emerald, ...). Pass the exact original Tailwind color classes
   * (bg/text, light + dark). Takes precedence over `variant` when set.
   */
  colorClassName?: string
  /** Optional display text override. Defaults to `status`. */
  label?: string
  /** Optional leading icon, e.g. <Clock size={12} />. Icon choice stays a per-call-site concern. */
  icon?: ReactNode
}

export function AdminStatusBadge({ status, variant = "neutral", colorClassName, label, icon }: AdminStatusBadgeProps) {
  const className = colorClassName ? `admin-badge ${colorClassName}` : `admin-badge-${variant}`
  return (
    <span className={className}>
      {icon}
      {label ?? status}
    </span>
  )
}
