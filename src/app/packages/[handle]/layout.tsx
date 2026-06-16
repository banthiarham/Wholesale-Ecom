import type { Metadata } from "next"

type Props = { params: Promise<{ handle: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  try {
    const res = await fetch(`${process.env.API_URL || "http://localhost:3000"}/api/v1/packages/${handle}`, { cache: "no-store" })
    if (!res.ok) return { title: "Package — WholesaleX Pro" }
    const data = await res.json()
    const pkg = data.package || data
    return {
      title: `${pkg.title} — WholesaleX Pro`,
      description: pkg.description || `Configure your ${pkg.title} package with custom components and exclusive discounts.`,
      openGraph: {
        title: `${pkg.title} — WholesaleX Pro`,
        description: pkg.description || `Configure your ${pkg.title} package with custom components and exclusive discounts.`,
        images: pkg.thumbnail || pkg.images?.[0] ? [pkg.thumbnail || pkg.images[0]] : undefined,
      },
    }
  } catch {
    return { title: "Package — WholesaleX Pro" }
  }
}

export default function PackageDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}