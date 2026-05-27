import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "var(--color-primary-50, #eff6ff)",
          100: "var(--color-primary-100, #dbeafe)",
          500: "var(--color-primary-500, #3b82f6)",
          600: "var(--color-primary-600, #2563eb)",
          700: "var(--color-primary-700, #1d4ed8)",
        },
        secondary: {
          50: "var(--color-secondary-50, #f8fafc)",
          500: "var(--color-secondary-500, #64748b)",
          600: "var(--color-secondary-600, #475569)",
        },
        accent: {
          50: "var(--color-accent-50, #fffbeb)",
          500: "var(--color-accent-500, #f59e0b)",
          600: "var(--color-accent-600, #d97706)",
        },
      },
      fontFamily: {
        heading: "var(--font-heading, Inter, sans-serif)",
        body: "var(--font-body, Inter, sans-serif)",
      },
      fontSize: {
        body: "var(--font-size-body, 16px)",
        heading: "var(--font-size-heading, 36px)",
      },
    },
  },
  plugins: [],
}
export default config