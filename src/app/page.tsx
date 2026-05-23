"use client"

import Link from "next/link"
import CategoryNav from "@/components/categories/CategoryNav"
import { useTranslation } from "@/lib/i18n/LanguageProvider"

export default function Home() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t("home.hero.title")}</h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            {t("home.hero.subtitle")}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/products" className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
              {t("home.hero.browse")}
            </Link>
            <Link href="/cart" className="px-6 py-3 bg-white text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition">
              {t("home.hero.viewcart")}
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("home.categories")}</h2>
          <CategoryNav />
        </div>
      </main>
    </div>
  )
}
