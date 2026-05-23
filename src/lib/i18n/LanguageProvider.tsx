"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
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
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("locale") as Locale | null
      if (saved === "en" || saved === "hi") return saved
    }
    return "en"
  })

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
