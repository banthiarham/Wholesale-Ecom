"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { adjustColor, generateShades, hexToRgb } from "./color-utils"

const DEFAULTS: Record<string, string> = {
  siteName: "WholesaleX Pro",
  tagline: "B2B Wholesale E-Commerce Platform",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#3b82f6",
  secondaryColor: "#64748b",
  accentColor: "#f59e0b",
  headingFont: "Inter",
  bodyFont: "Inter",
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

    // Convert hex shades to space-separated RGB format for CSS variables
    // e.g., "#2563EB" → "37 99 235" so that rgb(var(--color-primary-600) / 1) works
    const toRgbStr = (hex: string): string => {
      const { r, g, b } = hexToRgb(hex)
      return `${r} ${g} ${b}`
    }

    const primary = settings.primaryColor || DEFAULTS.primaryColor
    const primaryShades = generateShades(primary)
    root.style.setProperty("--color-primary-50", toRgbStr(primaryShades[50]))
    root.style.setProperty("--color-primary-100", toRgbStr(primaryShades[100]))
    root.style.setProperty("--color-primary-200", toRgbStr(primaryShades[200]))
    root.style.setProperty("--color-primary-300", toRgbStr(primaryShades[300]))
    root.style.setProperty("--color-primary-400", toRgbStr(primaryShades[400]))
    root.style.setProperty("--color-primary-500", toRgbStr(primaryShades[500]))
    root.style.setProperty("--color-primary-600", toRgbStr(primaryShades[600]))
    root.style.setProperty("--color-primary-700", toRgbStr(primaryShades[700]))
    root.style.setProperty("--color-primary-800", toRgbStr(primaryShades[800]))
    root.style.setProperty("--color-primary-900", toRgbStr(primaryShades[900]))

    const secondary = settings.secondaryColor || DEFAULTS.secondaryColor
    const secondaryShades = generateShades(secondary)
    root.style.setProperty("--color-secondary-50", toRgbStr(secondaryShades[50]))
    root.style.setProperty("--color-secondary-500", toRgbStr(secondaryShades[500]))
    root.style.setProperty("--color-secondary-600", toRgbStr(secondaryShades[600]))

    const accent = settings.accentColor || DEFAULTS.accentColor
    const accentShades = generateShades(accent)
    root.style.setProperty("--color-accent-50", toRgbStr(accentShades[50]))
    root.style.setProperty("--color-accent-500", toRgbStr(accentShades[500]))
    root.style.setProperty("--color-accent-600", toRgbStr(accentShades[600]))

    if (settings.bodyFontSize) {
      root.style.setProperty("--font-size-body", settings.bodyFontSize + "px")
    }
    if (settings.headingFontSize) {
      root.style.setProperty("--font-size-heading", settings.headingFontSize + "px")
    }

    const headingFont = settings.headingFont || DEFAULTS.headingFont
    const bodyFont = settings.bodyFont || DEFAULTS.bodyFont
    const fonts = Array.from(new Set([headingFont, bodyFont])).filter((f) => f !== "Inter")
    if (fonts.length > 0) {
      loadGoogleFonts(fonts)
    }
    root.style.setProperty("--font-heading", headingFont === "Inter" ? "Inter, sans-serif" : `'${headingFont}', sans-serif`)
    root.style.setProperty("--font-body", bodyFont === "Inter" ? "Inter, sans-serif" : `'${bodyFont}', sans-serif`)
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