/**
 * Return / replacement window. The admin sets a number of days (Settings -> Policies); it is
 * counted from the moment the order was marked delivered. 0 days turns returns off.
 */
export interface ReturnWindow {
  /** The order is delivered and still inside the window. */
  open: boolean
  /** Delivered, but the window has closed (or returns are switched off). */
  expired: boolean
  deadline: Date | null
  daysLeft: number
  windowDays: number
}

const DAY = 24 * 60 * 60 * 1000

export function parseWindowDays(raw: string | number | null | undefined): number {
  const n = Number.parseInt(String(raw ?? ""), 10)
  return Number.isFinite(n) ? n : 15
}

export function returnWindow(order: { status: string; deliveredAt?: string | null; updatedAt?: string | null }, windowDays: number): ReturnWindow {
  if (order.status !== "DELIVERED") return { open: false, expired: false, deadline: null, daysLeft: 0, windowDays }
  const base = order.deliveredAt || order.updatedAt
  if (!base) return { open: windowDays > 0, expired: windowDays <= 0, deadline: null, daysLeft: windowDays, windowDays }
  const deadline = new Date(new Date(base).getTime() + windowDays * DAY)
  const msLeft = deadline.getTime() - Date.now()
  const open = windowDays > 0 && msLeft >= 0
  return { open, expired: !open, deadline, daysLeft: Math.max(0, Math.ceil(msLeft / DAY)), windowDays }
}
