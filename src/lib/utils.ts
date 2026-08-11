import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Product images are almost always our own re-hosted local files (`/uploads/...`).
// Bulk import falls back to storing the original Excel URL as-is when a product
// image can't be downloaded/re-hosted, which can point at any external host the
// admin's spreadsheet happened to reference. next/image validates absolute src
// hostnames against next.config.mjs's `images.remotePatterns` and throws for any
// host not on that list — so an arbitrary external fallback URL would error in
// production. Passing `unoptimized` for these specific images skips that
// validation (and the optimizer proxy) without needing to allowlist every
// possible vendor domain up front.
export function isExternalImageUrl(src: string | null | undefined): boolean {
  return !!src && /^https?:\/\//i.test(src)
}

export function getCartSessionId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem("cart_session")
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    localStorage.setItem("cart_session", id)
  }
  return id
}

export function formatPrice(amount: number | string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(Number(amount))
}

export interface AddressData {
  fullName?: string
  phone?: string
  email?: string
  street?: string
  apartment?: string
  landmark?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export function formatAddress(addr: AddressData | null | undefined): string[] {
  if (!addr) return []
  const lines: string[] = []
  if (addr.fullName) lines.push(addr.fullName)
  if (addr.phone) lines.push(`Phone: ${addr.phone}`)
  if (addr.email) lines.push(addr.email)
  if (addr.street) lines.push(addr.street)
  if (addr.apartment) lines.push(addr.apartment)
  if (addr.landmark) lines.push(addr.landmark)
  const cityLine = [addr.city, addr.state, addr.zip].filter(Boolean).join(", ")
  if (cityLine) lines.push(cityLine)
  if (addr.country) lines.push(addr.country)
  return lines
}

export const COUNTRIES = [
  "India", "United States", "United Kingdom", "United Arab Emirates",
  "Saudi Arabia", "Singapore", "Bangladesh", "Nepal", "Sri Lanka",
  "China", "Thailand", "Malaysia", "Indonesia", "Australia", "Germany",
  "France", "Japan", "South Korea", "Canada", "Brazil",
]

/** Returns "white" or "black" text color for contrast against a hex background */
export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.55 ? "#000000" : "#ffffff"
}
