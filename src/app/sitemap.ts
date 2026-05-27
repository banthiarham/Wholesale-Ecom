import { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://wholesalex.com"
const apiUrl = process.env.NEXT_PUBLIC_API_URL || ""

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]

  let products: MetadataRoute.Sitemap = []
  let categories: MetadataRoute.Sitemap = []

  try {
    const [productsRes, categoriesRes] = await Promise.all([
      fetch(`${apiUrl}/api/products`, { next: { revalidate: 3600 } }),
      fetch(`${apiUrl}/api/categories`, { next: { revalidate: 3600 } }),
    ])

    if (productsRes.ok) {
      const productsData = await productsRes.json()
      products = (productsData.products || []).map((p: any) => ({
        url: `${siteUrl}/products/${p.handle}`,
        lastModified: new Date(p.updatedAt || p.createdAt || Date.now()),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
    }

    if (categoriesRes.ok) {
      const categoriesData = await categoriesRes.json()
      const flatCategories: any[] = []
      const flatten = (arr: any[]) => {
        for (const c of arr || []) {
          flatCategories.push(c)
          if (c.children) flatten(c.children)
        }
      }
      flatten(categoriesData.categories || [])

      categories = flatCategories.map((c: any) => ({
        url: `${siteUrl}/categories/${c.handle}`,
        lastModified: new Date(c.updatedAt || c.createdAt || Date.now()),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }))
    }
  } catch {
    // If API is unreachable, return just static pages
  }

  return [...staticPages, ...products, ...categories]
}