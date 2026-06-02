import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.siteSetting.findMany();
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return { ...this.getDefaults(), ...settings };
  }

  async findAllGrouped(): Promise<Record<string, { key: string; value: string; label: string; type: string }[]>> {
    const rows = await this.prisma.siteSetting.findMany();
    const defaults = this.getDefaultsWithMeta();
    const all = defaults.map((d) => {
      const existing = rows.find((r) => r.key === d.key);
      return {
        key: d.key,
        value: existing ? existing.value : d.value,
        label: existing ? existing.label : d.label,
        type: existing ? existing.type : d.type,
        group: d.group,
      };
    });

    const grouped: Record<string, { key: string; value: string; label: string; type: string }[]> = {};
    for (const item of all) {
      if (!grouped[item.group]) grouped[item.group] = [];
      grouped[item.group].push({ key: item.key, value: item.value, label: item.label, type: item.type });
    }
    return grouped;
  }

  async upsertMany(entries: { key: string; value: string }[]): Promise<Record<string, string>> {
    for (const entry of entries) {
      await this.prisma.siteSetting.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: {
          key: entry.key,
          value: entry.value,
          group: this.getGroupForKey(entry.key),
          label: this.getLabelForKey(entry.key),
          type: this.getTypeForKey(entry.key),
        },
      });
    }
    return this.findAll();
  }

  private getDefaults(): Record<string, string> {
    return {
      siteName: 'WholesaleX Pro',
      tagline: 'B2B Wholesale E-Commerce Platform',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#3b82f6',
      secondaryColor: '#64748b',
      accentColor: '#f59e0b',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingFontSize: '36',
      bodyFontSize: '16',
      heroBannerUrl: '',
      heroHeadline: 'Bulk Orders. Best Prices. Delivered.',
      heroSubtext: 'Connect with top vendors, get tier pricing, request quotes, and enjoy secure wholesale transactions.',
      heroCtaText: 'Browse Products',
      contactEmail: '',
      contactPhone: '',
      socialLinks: '{"facebook":"","twitter":"","instagram":"","linkedin":""}',
      copyrightText: 'WholesaleX Pro. All rights reserved.',
      announcementBarEnabled: 'false',
      announcementBarText: '',
      announcementBarColor: '#ffffff',
      announcementBarBgColor: '#ef4444',
      heroCarouselSpeed: '5000',
      heroCarouselAutoplay: 'true',
    };
  }

  private getDefaultsWithMeta() {
    return [
      { key: 'siteName', value: '', label: 'Site Name', type: 'text', group: 'branding' },
      { key: 'tagline', value: '', label: 'Tagline', type: 'text', group: 'branding' },
      { key: 'logoUrl', value: '', label: 'Logo Image', type: 'image', group: 'branding' },
      { key: 'faviconUrl', value: '', label: 'Favicon', type: 'image', group: 'branding' },
      { key: 'primaryColor', value: '#3b82f6', label: 'Primary Color', type: 'color', group: 'colors' },
      { key: 'secondaryColor', value: '#64748b', label: 'Secondary Color', type: 'color', group: 'colors' },
      { key: 'accentColor', value: '#f59e0b', label: 'Accent Color', type: 'color', group: 'colors' },
      { key: 'headingFont', value: 'Inter', label: 'Heading Font', type: 'text', group: 'typography' },
      { key: 'bodyFont', value: 'Inter', label: 'Body Font', type: 'text', group: 'typography' },
      { key: 'headingFontSize', value: '36', label: 'Heading Font Size (px)', type: 'number', group: 'typography' },
      { key: 'bodyFontSize', value: '16', label: 'Body Font Size (px)', type: 'number', group: 'typography' },
      { key: 'heroBannerUrl', value: '', label: 'Hero Banner Image', type: 'image', group: 'homepage' },
      { key: 'heroHeadline', value: '', label: 'Hero Headline', type: 'text', group: 'homepage' },
      { key: 'heroSubtext', value: '', label: 'Hero Subtext', type: 'text', group: 'homepage' },
      { key: 'heroCtaText', value: '', label: 'Hero CTA Text', type: 'text', group: 'homepage' },
      { key: 'contactEmail', value: '', label: 'Contact Email', type: 'text', group: 'header_footer' },
      { key: 'contactPhone', value: '', label: 'Contact Phone', type: 'text', group: 'header_footer' },
      { key: 'socialLinks', value: '{"facebook":"","twitter":"","instagram":"","linkedin":""}', label: 'Social Links', type: 'json', group: 'header_footer' },
      { key: 'copyrightText', value: '', label: 'Copyright Text', type: 'text', group: 'header_footer' },
      { key: 'announcementBarEnabled', value: 'false', label: 'Enable Announcement Bar', type: 'text', group: 'homepage' },
      { key: 'announcementBarText', value: '', label: 'Announcement Bar Text', type: 'text', group: 'homepage' },
      { key: 'announcementBarColor', value: '#ffffff', label: 'Announcement Text Color', type: 'color', group: 'homepage' },
      { key: 'announcementBarBgColor', value: '#ef4444', label: 'Announcement Background Color', type: 'color', group: 'homepage' },
      { key: 'heroCarouselSpeed', value: '5000', label: 'Carousel Speed (ms)', type: 'number', group: 'homepage' },
      { key: 'heroCarouselAutoplay', value: 'true', label: 'Auto-rotate Carousel', type: 'text', group: 'homepage' },
    ];
  }

  private getGroupForKey(key: string): string {
    const meta = this.getDefaultsWithMeta().find((d) => d.key === key);
    return meta?.group ?? 'general';
  }

  private getLabelForKey(key: string): string {
    const meta = this.getDefaultsWithMeta().find((d) => d.key === key);
    return meta?.label ?? key;
  }

  private getTypeForKey(key: string): string {
    const meta = this.getDefaultsWithMeta().find((d) => d.key === key);
    return meta?.type ?? 'text';
  }
}