"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { dictionary, Locale } from "./dictionary"

interface LanguageContextType {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start with "en" to match server render — read localStorage in useEffect
  // to avoid hydration mismatch that breaks React event handlers
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null
    if (saved === "en" || saved === "hi") {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", l)
      document.documentElement.lang = l
    }
  }, [])

  const t = useCallback(
    (key: string) => {
      return dictionary[locale]?.[key] || dictionary.en[key] || key
    },
    [locale]
  )

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}
