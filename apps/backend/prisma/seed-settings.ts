import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultSettings = [
  { key: 'siteName', value: 'WholesaleX Pro', group: 'branding', label: 'Site Name', type: 'text' },
  { key: 'tagline', value: 'B2B Wholesale E-Commerce Platform', group: 'branding', label: 'Tagline', type: 'text' },
  { key: 'logoUrl', value: '', group: 'branding', label: 'Logo Image', type: 'image' },
  { key: 'faviconUrl', value: '', group: 'branding', label: 'Favicon', type: 'image' },
  { key: 'primaryColor', value: '#3b82f6', group: 'colors', label: 'Primary Color', type: 'color' },
  { key: 'secondaryColor', value: '#64748b', group: 'colors', label: 'Secondary Color', type: 'color' },
  { key: 'accentColor', value: '#f59e0b', group: 'colors', label: 'Accent Color', type: 'color' },
  { key: 'headingFont', value: 'Inter', group: 'typography', label: 'Heading Font', type: 'text' },
  { key: 'bodyFont', value: 'Inter', group: 'typography', label: 'Body Font', type: 'text' },
  { key: 'headingFontSize', value: '36', group: 'typography', label: 'Heading Font Size (px)', type: 'number' },
  { key: 'bodyFontSize', value: '16', group: 'typography', label: 'Body Font Size (px)', type: 'number' },
  { key: 'heroBannerUrl', value: '', group: 'homepage', label: 'Hero Banner Image', type: 'image' },
  { key: 'heroHeadline', value: 'Bulk Orders. Best Prices. Delivered.', group: 'homepage', label: 'Hero Headline', type: 'text' },
  { key: 'heroSubtext', value: 'Connect with top vendors, get tier pricing, request quotes, and enjoy secure wholesale transactions.', group: 'homepage', label: 'Hero Subtext', type: 'text' },
  { key: 'heroCtaText', value: 'Browse Products', group: 'homepage', label: 'Hero CTA Text', type: 'text' },
  { key: 'contactEmail', value: '', group: 'header_footer', label: 'Contact Email', type: 'text' },
  { key: 'contactPhone', value: '', group: 'header_footer', label: 'Contact Phone', type: 'text' },
  { key: 'socialLinks', value: '{"facebook":"","twitter":"","instagram":"","linkedin":""}', group: 'header_footer', label: 'Social Links', type: 'json' },
  { key: 'copyrightText', value: 'WholesaleX Pro. All rights reserved.', group: 'header_footer', label: 'Copyright Text', type: 'text' },
];

async function main() {
  console.log('Seeding site settings...');
  for (const setting of defaultSettings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, label: setting.label, type: setting.type, group: setting.group },
      create: setting,
    });
  }
  console.log(`Seeded ${defaultSettings.length} settings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });