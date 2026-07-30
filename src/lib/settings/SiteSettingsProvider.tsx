"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { adjustColor, generateShades, hexToRgb } from "./color-utils"

// Self-hosted via next/font in layout.tsx (zero layout shift) — anything outside this set
// is fetched at runtime from Google Fonts when an admin picks it in settings.
const SELF_HOSTED_FONTS = new Set(["Inter", "Poppins", "Open Sans"])

const DEFAULTS: Record<string, string> = {
  siteName: "WholesaleX Pro",
  tagline: "B2B Wholesale E-Commerce Platform",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#0369a1",
  secondaryColor: "#0f172a",
  accentColor: "#f59e0b",
  headingFont: "Poppins",
  bodyFont: "Open Sans",
  headingFontSize: "36",
  bodyFontSize: "16",
  heroBannerUrl: "",
  heroHeadline: "Bulk Orders. Best Prices. Delivered.",
  heroSubtext: "Connect with top vendors, get tier pricing, request quotes, and enjoy secure wholesale transactions.",
  heroCtaText: "Browse Products",
  contactEmail: "",
  contactPhone: "",
  socialLinks: '{"facebook":"","twitter":"","instagram":"","linkedin":""}',
  copyrightText: "WholesaleX Pro. All rights reserved.",
  announcementBarEnabled: "false",
  announcementBarText: "",
  announcementBarColor: "#ffffff",
  announcementBarBgColor: "#ef4444",
  heroCarouselSpeed: "5000",
  heroCarouselAutoplay: "true",
}

interface SiteSettingsContextType {
  settings: Record<string, string>
  loaded: boolean
}

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  settings: DEFAULTS,
  loaded: false,
})

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Track client-side mount to avoid hydration mismatches
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }))
        }
      })
      .catch((err) => { console.error("Failed to fetch site settings:", err) })
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!mounted || !loaded) return
    const root = document.documentElement

    // CSS variables must be space-separated R G B values (no rgb() wrapper)
    // because Tailwind uses: rgb(var(--color-primary-600) / <alpha-value>)
    const toRgbTriplet = (hex: string): string => {
      const { r, g, b } = hexToRgb(hex)
      return `${r} ${g} ${b}`
    }

    const primary = settings.primaryColor || DEFAULTS.primaryColor
    const primaryShades = generateShades(primary)
    root.style.setProperty("--color-primary-50",  toRgbTriplet(primaryShades[50]))
    root.style.setProperty("--color-primary-100", toRgbTriplet(primaryShades[100]))
    root.style.setProperty("--color-primary-200", toRgbTriplet(primaryShades[200]))
    root.style.setProperty("--color-primary-300", toRgbTriplet(primaryShades[300]))
    root.style.setProperty("--color-primary-400", toRgbTriplet(primaryShades[400]))
    root.style.setProperty("--color-primary-500", toRgbTriplet(primaryShades[500]))
    root.style.setProperty("--color-primary-600", toRgbTriplet(primaryShades[600]))
    root.style.setProperty("--color-primary-700", toRgbTriplet(primaryShades[700]))
    root.style.setProperty("--color-primary-800", toRgbTriplet(primaryShades[800]))
    root.style.setProperty("--color-primary-900", toRgbTriplet(primaryShades[900]))

    const secondary = settings.secondaryColor || DEFAULTS.secondaryColor
    const secondaryShades = generateShades(secondary)
    root.style.setProperty("--color-secondary-50",  toRgbTriplet(secondaryShades[50]))
    root.style.setProperty("--color-secondary-500", toRgbTriplet(secondaryShades[500]))
    root.style.setProperty("--color-secondary-600", toRgbTriplet(secondaryShades[600]))

    const accent = settings.accentColor || DEFAULTS.accentColor
    const accentShades = generateShades(accent)
    root.style.setProperty("--color-accent-50",  toRgbTriplet(accentShades[50]))
    root.style.setProperty("--color-accent-500", toRgbTriplet(accentShades[500]))
    root.style.setProperty("--color-accent-600", toRgbTriplet(accentShades[600]))

    if (settings.bodyFontSize) {
      root.style.setProperty("--font-size-body", settings.bodyFontSize + "px")
    }
    if (settings.headingFontSize) {
      root.style.setProperty("--font-size-heading", settings.headingFontSize + "px")
    }

    const headingFont = settings.headingFont || DEFAULTS.headingFont
    const bodyFont = settings.bodyFont || DEFAULTS.bodyFont
    // Inter/Poppins/Open Sans are self-hosted via next/font in layout.tsx (zero layout shift) — only
    // fetch a dynamic Google Fonts stylesheet for fonts an admin picks outside that set.
    const fonts = Array.from(new Set([headingFont, bodyFont])).filter((f) => !SELF_HOSTED_FONTS.has(f))
    if (fonts.length > 0) {
      loadGoogleFonts(fonts)
    }
    root.style.setProperty("--font-heading", `'${headingFont}', sans-serif`)
    root.style.setProperty("--font-body", `'${bodyFont}', sans-serif`)
  }, [settings, loaded, mounted])

  return (
    <SiteSettingsContext.Provider value={{ settings, loaded }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}

export function useSetting(key: string, fallback: string): string {
  const { settings } = useSiteSettings()
  return settings[key] ?? fallback
}

function loadGoogleFonts(fonts: string[]) {
  const existing = document.getElementById("dynamic-google-fonts")
  if (existing) existing.remove()

  const families = fonts.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&")
  const link = document.createElement("link")
  link.id = "dynamic-google-fonts"
  link.rel = "stylesheet"
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
  document.head.appendChild(link)
}