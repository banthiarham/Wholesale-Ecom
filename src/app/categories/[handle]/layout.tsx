import type { Metadata } from "next"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://wholesalex.com"
const apiUrl = process.env.NEXT_PUBLIC_API_URL || ""

type Props = {
  params: { handle: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const res = await fetch(`${apiUrl}/api/categories/${params.handle}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return { title: "Category Not Found" }

    const data = await res.json()
    const category = data.category
    if (!category) return { title: "Category Not Found" }

    const description =
      category.description?.slice(0, 160) ||
      `Shop wholesale ${category.name} products at bulk prices. Fast shipping across India.`

    return {
      title: category.name,
      description,
      openGraph: {
        title: `${category.name} — WholesaleX Pro`,
        description,
        type: "website",
      },
      alternates: {
        canonical: `${siteUrl}/categories/${category.handle}`,
      },
    }
  } catch {
    return { title: "Category" }
  }
}

export default function CategoryDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}