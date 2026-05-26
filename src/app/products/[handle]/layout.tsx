import type { Metadata } from "next"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://wholesalex.com"
const apiUrl = process.env.NEXT_PUBLIC_API_URL || ""

type Props = {
  params: { handle: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const res = await fetch(`${apiUrl}/api/products/${params.handle}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return { title: "Product Not Found" }

    const data = await res.json()
    const product = data.product
    if (!product) return { title: "Product Not Found" }

    const description =
      product.description?.slice(0, 160) ||
      `Buy ${product.title} at wholesale prices. MOQ: ${product.moq}. Bulk discounts available.`

    return {
      title: product.title,
      description,
      openGraph: {
        title: product.title,
        description,
        images: product.thumbnail ? [{ url: product.thumbnail, width: 800, height: 600, alt: product.title }] : [],
        type: "website",
      },
      alternates: {
        canonical: `${siteUrl}/products/${product.handle}`,
      },
    }
  } catch {
    return { title: "Product" }
  }
}

export default function ProductDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}