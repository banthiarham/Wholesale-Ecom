import { PrismaClient, UserRole, UserStatus, AccountType, ProductStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const COUPON_CODE = 'DEEPANSHU';
const COUPON_DISCOUNT_PERCENT = 10;

const prisma = new PrismaClient();

interface SeedTier {
  minQty: number;
  maxQty?: number;
  price: number;
}

interface SeedProduct {
  title: string;
  handle: string;
  description: string;
  sku: string;
  moq: number;
  unitPrice: number;
  compareAtPrice: number;
  inventoryQuantity: number;
  tags: string[];
  rating: number;
  reviewCount: number;
  tiers: SeedTier[];
}

interface SeedCategory {
  name: string;
  handle: string;
  description: string;
  vendorName: string;
  products: SeedProduct[];
}

const img = (seed: string, n: number, size = 800) =>
  `https://picsum.photos/seed/wholesalex-${seed}-${n}/${size}/${size}`;

const CATALOG: SeedCategory[] = [
  {
    name: 'Electronics',
    handle: 'electronics',
    description: 'Consumer electronics, gadgets, and accessories for bulk resale.',
    vendorName: 'AudioTech Corp',
    products: [
      { title: 'Wireless Earbuds Pro', handle: 'wireless-earbuds-pro', description: 'High-quality wireless earbuds with active noise cancellation and 30-hour battery life. Ideal for retail bundling and corporate gifting.', sku: 'ELEC-001', moq: 10, unitPrice: 2500, compareAtPrice: 3000, inventoryQuantity: 500, tags: ['electronics', 'audio', 'wireless', 'best-seller'], rating: 4.5, reviewCount: 34, tiers: [{ minQty: 10, maxQty: 49, price: 2400 }, { minQty: 50, maxQty: 99, price: 2200 }, { minQty: 100, price: 2000 }] },
      { title: 'Smart LED Panel 24W', handle: 'smart-led-panel-24w', description: 'Energy-efficient 24W LED panel light suited for offices, showrooms, and commercial retrofits.', sku: 'ELEC-002', moq: 20, unitPrice: 850, compareAtPrice: 1000, inventoryQuantity: 300, tags: ['electronics', 'lighting', 'energy-saving'], rating: 4.3, reviewCount: 22, tiers: [{ minQty: 20, maxQty: 99, price: 800 }, { minQty: 100, price: 750 }] },
      { title: 'Bluetooth Speaker 20W', handle: 'bluetooth-speaker-20w', description: 'Portable 20W Bluetooth speaker with deep bass and IPX5 water resistance, perfect for retail and events.', sku: 'ELEC-003', moq: 15, unitPrice: 1200, compareAtPrice: 1500, inventoryQuantity: 260, tags: ['electronics', 'audio', 'bluetooth'], rating: 4.4, reviewCount: 19, tiers: [{ minQty: 15, maxQty: 49, price: 1150 }, { minQty: 50, price: 1050 }] },
      { title: 'USB-C Fast Charger 65W', handle: 'usb-c-fast-charger-65w', description: 'GaN-based 65W USB-C charger compatible with laptops, tablets, and smartphones. Compact wholesale-ready packaging.', sku: 'ELEC-004', moq: 50, unitPrice: 450, compareAtPrice: 600, inventoryQuantity: 800, tags: ['electronics', 'charging', 'best-seller'], rating: 4.6, reviewCount: 41, tiers: [{ minQty: 50, maxQty: 199, price: 420 }, { minQty: 200, price: 390 }] },
      { title: 'Power Bank 20000mAh', handle: 'power-bank-20000mah', description: 'High-capacity 20000mAh power bank with dual USB output and fast charging support.', sku: 'ELEC-005', moq: 25, unitPrice: 950, compareAtPrice: 1200, inventoryQuantity: 400, tags: ['electronics', 'charging', 'portable'], rating: 4.2, reviewCount: 27, tiers: [{ minQty: 25, maxQty: 99, price: 900 }, { minQty: 100, price: 850 }] },
      { title: 'Smart Watch Fitness Tracker', handle: 'smart-watch-fitness-tracker', description: 'Fitness tracking smartwatch with heart-rate monitor, SpO2, and 7-day battery — great for retail bundles.', sku: 'ELEC-006', moq: 10, unitPrice: 1800, compareAtPrice: 2400, inventoryQuantity: 220, tags: ['electronics', 'wearable'], rating: 4.1, reviewCount: 16, tiers: [{ minQty: 10, maxQty: 49, price: 1700 }, { minQty: 50, price: 1600 }] },
      { title: 'HD Webcam 1080p', handle: 'hd-webcam-1080p', description: '1080p HD webcam with built-in noise-cancelling mic, designed for remote work and conferencing setups.', sku: 'ELEC-007', moq: 20, unitPrice: 1100, compareAtPrice: 1400, inventoryQuantity: 180, tags: ['electronics', 'computer-accessories'], rating: 4.0, reviewCount: 12, tiers: [{ minQty: 20, maxQty: 79, price: 1050 }, { minQty: 80, price: 980 }] },
      { title: 'Wireless Mouse Combo Pack', handle: 'wireless-mouse-combo-pack', description: 'Ergonomic wireless mouse and keyboard combo pack, sold in bulk for office and institutional supply.', sku: 'ELEC-008', moq: 30, unitPrice: 350, compareAtPrice: 500, inventoryQuantity: 600, tags: ['electronics', 'computer-accessories'], rating: 4.3, reviewCount: 23, tiers: [{ minQty: 30, maxQty: 99, price: 330 }, { minQty: 100, price: 300 }] },
      { title: 'Portable SSD 1TB', handle: 'portable-ssd-1tb', description: 'USB 3.2 portable SSD with 1TB storage and up to 1050MB/s transfer speed.', sku: 'ELEC-009', moq: 10, unitPrice: 4200, compareAtPrice: 5000, inventoryQuantity: 150, tags: ['electronics', 'storage'], rating: 4.7, reviewCount: 31, tiers: [{ minQty: 10, maxQty: 39, price: 4000 }, { minQty: 40, price: 3800 }] },
      { title: 'LED Desk Lamp', handle: 'led-desk-lamp', description: 'Adjustable LED desk lamp with 3 brightness modes and USB charging port — ideal for office bulk orders.', sku: 'ELEC-010', moq: 25, unitPrice: 650, compareAtPrice: 850, inventoryQuantity: 320, tags: ['electronics', 'lighting'], rating: 4.2, reviewCount: 18, tiers: [{ minQty: 25, maxQty: 99, price: 610 }, { minQty: 100, price: 570 }] },
    ],
  },
  {
    name: 'Fashion',
    handle: 'fashion',
    description: 'Apparel and accessories for wholesale and bulk uniform orders.',
    vendorName: 'TextileHub India',
    products: [
      { title: 'Cotton T-Shirt Bulk', handle: 'cotton-t-shirt-bulk', description: 'Premium 100% cotton t-shirts available in bulk, ideal for company uniforms and events.', sku: 'FASH-001', moq: 50, unitPrice: 150, compareAtPrice: 200, inventoryQuantity: 2000, tags: ['fashion', 'apparel', 'cotton', 'best-seller'], rating: 4.2, reviewCount: 38, tiers: [{ minQty: 50, maxQty: 199, price: 140 }, { minQty: 200, price: 120 }] },
      { title: 'Formal Shirt Pack (Men)', handle: 'formal-shirt-pack-men', description: 'Wrinkle-resistant formal shirts for men, sold in bulk packs for corporate and retail supply.', sku: 'FASH-002', moq: 30, unitPrice: 450, compareAtPrice: 600, inventoryQuantity: 700, tags: ['fashion', 'apparel', 'formal'], rating: 4.1, reviewCount: 15, tiers: [{ minQty: 30, maxQty: 99, price: 420 }, { minQty: 100, price: 390 }] },
      { title: 'Denim Jeans Wholesale', handle: 'denim-jeans-wholesale', description: 'Durable stretch-denim jeans in assorted sizes, packed for wholesale distribution.', sku: 'FASH-003', moq: 20, unitPrice: 650, compareAtPrice: 850, inventoryQuantity: 500, tags: ['fashion', 'apparel', 'denim'], rating: 4.3, reviewCount: 21, tiers: [{ minQty: 20, maxQty: 79, price: 610 }, { minQty: 80, price: 570 }] },
      { title: "Women's Kurti Set", handle: 'womens-kurti-set', description: 'Comfortable cotton-blend kurti sets in assorted prints, sold in wholesale packs.', sku: 'FASH-004', moq: 30, unitPrice: 380, compareAtPrice: 500, inventoryQuantity: 600, tags: ['fashion', 'apparel', 'ethnic'], rating: 4.4, reviewCount: 29, tiers: [{ minQty: 30, maxQty: 99, price: 355 }, { minQty: 100, price: 330 }] },
      { title: 'Winter Hoodie Pack', handle: 'winter-hoodie-pack', description: 'Fleece-lined hoodies for winter season retail, available in bulk assorted-size packs.', sku: 'FASH-005', moq: 25, unitPrice: 550, compareAtPrice: 750, inventoryQuantity: 400, tags: ['fashion', 'apparel', 'winter-wear'], rating: 4.0, reviewCount: 14, tiers: [{ minQty: 25, maxQty: 99, price: 520 }, { minQty: 100, price: 480 }] },
      { title: 'Cotton Socks (12-Pair Pack)', handle: 'cotton-socks-12-pair-pack', description: 'Breathable cotton socks sold in 12-pair wholesale packs, popular for retail and gifting.', sku: 'FASH-006', moq: 50, unitPrice: 180, compareAtPrice: 250, inventoryQuantity: 1500, tags: ['fashion', 'accessories'], rating: 4.1, reviewCount: 26, tiers: [{ minQty: 50, maxQty: 199, price: 165 }, { minQty: 200, price: 150 }] },
      { title: 'Canvas Tote Bags', handle: 'canvas-tote-bags', description: 'Eco-friendly canvas tote bags, blank or printable, sold in bulk for retail and promotional use.', sku: 'FASH-007', moq: 40, unitPrice: 120, compareAtPrice: 180, inventoryQuantity: 900, tags: ['fashion', 'accessories', 'eco-friendly'], rating: 4.3, reviewCount: 20, tiers: [{ minQty: 40, maxQty: 149, price: 110 }, { minQty: 150, price: 95 }] },
      { title: 'Leather Wallets Bulk', handle: 'leather-wallets-bulk', description: 'Genuine leather bi-fold wallets, wholesale packed for retail chains and gifting suppliers.', sku: 'FASH-008', moq: 30, unitPrice: 280, compareAtPrice: 400, inventoryQuantity: 350, tags: ['fashion', 'accessories', 'leather'], rating: 4.5, reviewCount: 24, tiers: [{ minQty: 30, maxQty: 99, price: 260 }, { minQty: 100, price: 235 }] },
      { title: 'Sports Cap Pack', handle: 'sports-cap-pack', description: 'Adjustable sports caps in assorted colors, sold in bulk for teams, retail, and events.', sku: 'FASH-009', moq: 50, unitPrice: 90, compareAtPrice: 140, inventoryQuantity: 1200, tags: ['fashion', 'accessories', 'sportswear'], rating: 4.0, reviewCount: 11, tiers: [{ minQty: 50, maxQty: 199, price: 80 }, { minQty: 200, price: 70 }] },
      { title: 'Formal Trousers Bulk', handle: 'formal-trousers-bulk', description: 'Tailored formal trousers in classic fits, wholesale packed for uniform and retail supply.', sku: 'FASH-010', moq: 25, unitPrice: 520, compareAtPrice: 700, inventoryQuantity: 450, tags: ['fashion', 'apparel', 'formal'], rating: 4.2, reviewCount: 17, tiers: [{ minQty: 25, maxQty: 99, price: 490 }, { minQty: 100, price: 455 }] },
    ],
  },
  {
    name: 'Industrial',
    handle: 'industrial',
    description: 'Heavy-duty tools, safety gear, and machinery for industrial buyers.',
    vendorName: 'ToolsMax Industries',
    products: [
      { title: 'Industrial Drill Machine', handle: 'industrial-drill-machine', description: 'Heavy-duty drill machine built for continuous industrial use with variable speed control.', sku: 'INDL-001', moq: 5, unitPrice: 12000, compareAtPrice: 15000, inventoryQuantity: 50, tags: ['industrial', 'tools', 'machinery', 'best-seller'], rating: 4.8, reviewCount: 25, tiers: [{ minQty: 5, maxQty: 19, price: 11500 }, { minQty: 20, price: 11000 }] },
      { title: 'Heavy Duty Angle Grinder', handle: 'heavy-duty-angle-grinder', description: 'High-torque angle grinder for metal fabrication and construction sites, sold in bulk units.', sku: 'INDL-002', moq: 10, unitPrice: 3200, compareAtPrice: 4000, inventoryQuantity: 120, tags: ['industrial', 'tools', 'power-tools'], rating: 4.5, reviewCount: 18, tiers: [{ minQty: 10, maxQty: 39, price: 3050 }, { minQty: 40, price: 2900 }] },
      { title: 'Safety Helmet Pack', handle: 'safety-helmet-pack', description: 'ISI-marked industrial safety helmets, wholesale packed for construction and factory sites.', sku: 'INDL-003', moq: 50, unitPrice: 220, compareAtPrice: 300, inventoryQuantity: 900, tags: ['industrial', 'safety-gear'], rating: 4.3, reviewCount: 22, tiers: [{ minQty: 50, maxQty: 199, price: 205 }, { minQty: 200, price: 185 }] },
      { title: 'Industrial Work Gloves', handle: 'industrial-work-gloves', description: 'Cut-resistant work gloves for industrial handling, sold in wholesale case quantities.', sku: 'INDL-004', moq: 100, unitPrice: 45, compareAtPrice: 65, inventoryQuantity: 3000, tags: ['industrial', 'safety-gear'], rating: 4.1, reviewCount: 16, tiers: [{ minQty: 100, maxQty: 499, price: 40 }, { minQty: 500, price: 35 }] },
      { title: 'Hydraulic Jack 5-Ton', handle: 'hydraulic-jack-5-ton', description: '5-ton capacity hydraulic bottle jack for heavy vehicle and industrial lifting applications.', sku: 'INDL-005', moq: 5, unitPrice: 4800, compareAtPrice: 6000, inventoryQuantity: 80, tags: ['industrial', 'tools', 'equipment'], rating: 4.4, reviewCount: 13, tiers: [{ minQty: 5, maxQty: 19, price: 4550 }, { minQty: 20, price: 4300 }] },
      { title: 'Steel Toolbox Set', handle: 'steel-toolbox-set', description: 'Rugged steel toolbox pre-fitted with essential hand tools, sold wholesale for maintenance teams.', sku: 'INDL-006', moq: 10, unitPrice: 1600, compareAtPrice: 2000, inventoryQuantity: 150, tags: ['industrial', 'tools'], rating: 4.2, reviewCount: 10, tiers: [{ minQty: 10, maxQty: 39, price: 1500 }, { minQty: 40, price: 1400 }] },
      { title: 'Industrial Extension Cord 30m', handle: 'industrial-extension-cord-30m', description: 'Heavy-gauge 30m extension cord rated for industrial power loads and outdoor use.', sku: 'INDL-007', moq: 20, unitPrice: 750, compareAtPrice: 950, inventoryQuantity: 200, tags: ['industrial', 'electrical'], rating: 4.0, reviewCount: 9, tiers: [{ minQty: 20, maxQty: 79, price: 700 }, { minQty: 80, price: 650 }] },
      { title: 'Welding Machine 200A', handle: 'welding-machine-200a', description: 'Inverter-based 200A arc welding machine suitable for industrial fabrication workshops.', sku: 'INDL-008', moq: 3, unitPrice: 8500, compareAtPrice: 10500, inventoryQuantity: 40, tags: ['industrial', 'machinery', 'best-seller'], rating: 4.6, reviewCount: 20, tiers: [{ minQty: 3, maxQty: 9, price: 8200 }, { minQty: 10, price: 7800 }] },
      { title: 'Air Compressor 50L', handle: 'air-compressor-50l', description: '50-litre air compressor for pneumatic tools and industrial workshop applications.', sku: 'INDL-009', moq: 5, unitPrice: 9200, compareAtPrice: 11500, inventoryQuantity: 35, tags: ['industrial', 'machinery'], rating: 4.5, reviewCount: 12, tiers: [{ minQty: 5, maxQty: 19, price: 8800 }, { minQty: 20, price: 8400 }] },
      { title: 'Industrial LED Flood Light', handle: 'industrial-led-flood-light', description: 'Weatherproof LED flood light for warehouses, yards, and industrial site lighting.', sku: 'INDL-010', moq: 15, unitPrice: 1350, compareAtPrice: 1700, inventoryQuantity: 220, tags: ['industrial', 'lighting'], rating: 4.3, reviewCount: 14, tiers: [{ minQty: 15, maxQty: 59, price: 1280 }, { minQty: 60, price: 1200 }] },
    ],
  },
  {
    name: 'Home & Kitchen',
    handle: 'home-kitchen',
    description: 'Cookware, home essentials, and decor for retail and hospitality bulk orders.',
    vendorName: 'HomeStyle Wholesale Co.',
    products: [
      { title: 'Non-Stick Cookware Set', handle: 'non-stick-cookware-set', description: '5-piece non-stick cookware set, wholesale packed for retail and hospitality supply.', sku: 'HOME-001', moq: 10, unitPrice: 1450, compareAtPrice: 1800, inventoryQuantity: 260, tags: ['home-kitchen', 'cookware', 'best-seller'], rating: 4.4, reviewCount: 28, tiers: [{ minQty: 10, maxQty: 39, price: 1380 }, { minQty: 40, price: 1300 }] },
      { title: 'Stainless Steel Dinner Set', handle: 'stainless-steel-dinner-set', description: '24-piece stainless steel dinner set, durable and dishwasher safe, sold wholesale.', sku: 'HOME-002', moq: 15, unitPrice: 980, compareAtPrice: 1300, inventoryQuantity: 200, tags: ['home-kitchen', 'dinnerware'], rating: 4.3, reviewCount: 19, tiers: [{ minQty: 15, maxQty: 59, price: 930 }, { minQty: 60, price: 870 }] },
      { title: 'Electric Kettle 1.8L', handle: 'electric-kettle-1-8l', description: 'Fast-boil 1.8L electric kettle with auto shut-off, packed for wholesale distribution.', sku: 'HOME-003', moq: 20, unitPrice: 550, compareAtPrice: 700, inventoryQuantity: 340, tags: ['home-kitchen', 'appliances'], rating: 4.2, reviewCount: 21, tiers: [{ minQty: 20, maxQty: 79, price: 520 }, { minQty: 80, price: 480 }] },
      { title: 'Kitchen Knife Set', handle: 'kitchen-knife-set', description: '6-piece stainless steel kitchen knife set with wooden block, sold in bulk for retail.', sku: 'HOME-004', moq: 25, unitPrice: 380, compareAtPrice: 500, inventoryQuantity: 450, tags: ['home-kitchen', 'cookware'], rating: 4.1, reviewCount: 15, tiers: [{ minQty: 25, maxQty: 99, price: 355 }, { minQty: 100, price: 330 }] },
      { title: 'Storage Container Set (10pc)', handle: 'storage-container-set-10pc', description: 'Airtight 10-piece kitchen storage container set, wholesale packed for retail chains.', sku: 'HOME-005', moq: 30, unitPrice: 320, compareAtPrice: 450, inventoryQuantity: 600, tags: ['home-kitchen', 'storage'], rating: 4.0, reviewCount: 12, tiers: [{ minQty: 30, maxQty: 99, price: 300 }, { minQty: 100, price: 275 }] },
      { title: 'Ceramic Mug Set (6pc)', handle: 'ceramic-mug-set-6pc', description: '6-piece ceramic mug set in assorted colors, ideal for retail, cafes, and gifting.', sku: 'HOME-006', moq: 20, unitPrice: 280, compareAtPrice: 380, inventoryQuantity: 500, tags: ['home-kitchen', 'dinnerware'], rating: 4.3, reviewCount: 17, tiers: [{ minQty: 20, maxQty: 79, price: 260 }, { minQty: 80, price: 240 }] },
      { title: 'Mixer Grinder 750W', handle: 'mixer-grinder-750w', description: '750W mixer grinder with 3 jars, built for durability in retail and household bulk supply.', sku: 'HOME-007', moq: 10, unitPrice: 1850, compareAtPrice: 2300, inventoryQuantity: 180, tags: ['home-kitchen', 'appliances', 'best-seller'], rating: 4.5, reviewCount: 30, tiers: [{ minQty: 10, maxQty: 39, price: 1750 }, { minQty: 40, price: 1650 }] },
      { title: 'Bed Sheet Set (King Size)', handle: 'bed-sheet-set-king-size', description: 'Soft cotton-blend king-size bed sheet sets with pillow covers, sold wholesale.', sku: 'HOME-008', moq: 20, unitPrice: 650, compareAtPrice: 850, inventoryQuantity: 320, tags: ['home-kitchen', 'bedding'], rating: 4.2, reviewCount: 16, tiers: [{ minQty: 20, maxQty: 79, price: 610 }, { minQty: 80, price: 570 }] },
      { title: 'Bath Towel Bulk Pack', handle: 'bath-towel-bulk-pack', description: 'Absorbent cotton bath towels sold in wholesale packs for hospitality and retail.', sku: 'HOME-009', moq: 40, unitPrice: 190, compareAtPrice: 260, inventoryQuantity: 800, tags: ['home-kitchen', 'bedding'], rating: 4.1, reviewCount: 14, tiers: [{ minQty: 40, maxQty: 149, price: 175 }, { minQty: 150, price: 160 }] },
      { title: 'Table Lamp Decor Set', handle: 'table-lamp-decor-set', description: 'Decorative table lamps with fabric shades, wholesale packed for home decor retailers.', sku: 'HOME-010', moq: 15, unitPrice: 720, compareAtPrice: 950, inventoryQuantity: 150, tags: ['home-kitchen', 'decor'], rating: 4.0, reviewCount: 11, tiers: [{ minQty: 15, maxQty: 59, price: 680 }, { minQty: 60, price: 630 }] },
    ],
  },
  {
    name: 'Health & Beauty',
    handle: 'health-beauty',
    description: 'Personal care, wellness, and hygiene products for bulk and institutional buyers.',
    vendorName: 'CarePlus Wellness Supplies',
    products: [
      { title: 'Hand Sanitizer 500ml (Case of 24)', handle: 'hand-sanitizer-500ml-case-24', description: '70% alcohol-based hand sanitizer, sold in bulk cases of 24 bottles for institutional supply.', sku: 'HLTH-001', moq: 10, unitPrice: 1200, compareAtPrice: 1500, inventoryQuantity: 300, tags: ['health-beauty', 'hygiene', 'best-seller'], rating: 4.4, reviewCount: 26, tiers: [{ minQty: 10, maxQty: 39, price: 1130 }, { minQty: 40, price: 1050 }] },
      { title: 'Face Mask 3-Ply (Box of 50)', handle: 'face-mask-3-ply-box-50', description: 'Disposable 3-ply face masks, breathable and skin-friendly, sold in boxes of 50.', sku: 'HLTH-002', moq: 20, unitPrice: 180, compareAtPrice: 250, inventoryQuantity: 1000, tags: ['health-beauty', 'hygiene'], rating: 4.2, reviewCount: 20, tiers: [{ minQty: 20, maxQty: 79, price: 165 }, { minQty: 80, price: 150 }] },
      { title: 'Herbal Shampoo 1L Bulk', handle: 'herbal-shampoo-1l-bulk', description: 'Sulfate-free herbal shampoo in 1L wholesale bottles, popular with salons and retailers.', sku: 'HLTH-003', moq: 25, unitPrice: 320, compareAtPrice: 420, inventoryQuantity: 400, tags: ['health-beauty', 'personal-care'], rating: 4.3, reviewCount: 18, tiers: [{ minQty: 25, maxQty: 99, price: 300 }, { minQty: 100, price: 280 }] },
      { title: 'Organic Soap Bar Pack (12pc)', handle: 'organic-soap-bar-pack-12pc', description: 'Handmade organic soap bars, wholesale packed in sets of 12, ideal for retail and gifting.', sku: 'HLTH-004', moq: 30, unitPrice: 380, compareAtPrice: 500, inventoryQuantity: 500, tags: ['health-beauty', 'personal-care'], rating: 4.5, reviewCount: 24, tiers: [{ minQty: 30, maxQty: 99, price: 355 }, { minQty: 100, price: 330 }] },
      { title: 'Vitamin C Serum 30ml', handle: 'vitamin-c-serum-30ml', description: 'Brightening vitamin C face serum, wholesale packed for salons and skincare retailers.', sku: 'HLTH-005', moq: 20, unitPrice: 650, compareAtPrice: 850, inventoryQuantity: 260, tags: ['health-beauty', 'skincare'], rating: 4.6, reviewCount: 29, tiers: [{ minQty: 20, maxQty: 79, price: 610 }, { minQty: 80, price: 570 }] },
      { title: 'Digital Thermometer Bulk', handle: 'digital-thermometer-bulk', description: 'Fast-read digital thermometers, sold in bulk for clinics, schools, and institutions.', sku: 'HLTH-006', moq: 50, unitPrice: 150, compareAtPrice: 200, inventoryQuantity: 900, tags: ['health-beauty', 'medical-supplies'], rating: 4.1, reviewCount: 13, tiers: [{ minQty: 50, maxQty: 199, price: 140 }, { minQty: 200, price: 125 }] },
      { title: 'First Aid Kit Box', handle: 'first-aid-kit-box', description: 'Comprehensive first aid kit box for offices, schools, and factories, sold wholesale.', sku: 'HLTH-007', moq: 15, unitPrice: 480, compareAtPrice: 650, inventoryQuantity: 220, tags: ['health-beauty', 'medical-supplies'], rating: 4.4, reviewCount: 16, tiers: [{ minQty: 15, maxQty: 59, price: 450 }, { minQty: 60, price: 420 }] },
      { title: 'Massage Oil 200ml Bulk', handle: 'massage-oil-200ml-bulk', description: 'Nourishing herbal massage oil in 200ml wholesale bottles, popular with spas and salons.', sku: 'HLTH-008', moq: 25, unitPrice: 280, compareAtPrice: 380, inventoryQuantity: 340, tags: ['health-beauty', 'personal-care'], rating: 4.2, reviewCount: 15, tiers: [{ minQty: 25, maxQty: 99, price: 260 }, { minQty: 100, price: 240 }] },
      { title: 'Electric Toothbrush Pack', handle: 'electric-toothbrush-pack', description: 'Rechargeable electric toothbrushes with multiple brush heads, sold in wholesale packs.', sku: 'HLTH-009', moq: 20, unitPrice: 950, compareAtPrice: 1200, inventoryQuantity: 180, tags: ['health-beauty', 'personal-care'], rating: 4.3, reviewCount: 17, tiers: [{ minQty: 20, maxQty: 79, price: 900 }, { minQty: 80, price: 840 }] },
      { title: 'Multivitamin Tablets (Bottle of 60)', handle: 'multivitamin-tablets-bottle-60', description: 'Daily multivitamin tablets, 60-count bottles, sold in bulk for pharmacies and wellness retailers.', sku: 'HLTH-010', moq: 30, unitPrice: 420, compareAtPrice: 550, inventoryQuantity: 500, tags: ['health-beauty', 'wellness'], rating: 4.4, reviewCount: 22, tiers: [{ minQty: 30, maxQty: 99, price: 395 }, { minQty: 100, price: 365 }] },
    ],
  },
];

const REVIEW_TEMPLATES: { title: string; body: string }[] = [
  { title: 'Great value for bulk purchase', body: 'Ordered a large quantity for our business and the quality was consistent across the whole batch. Will reorder.' },
  { title: 'Reliable quality, fast delivery', body: 'Exactly as described. Packaging was solid for a bulk shipment and nothing arrived damaged.' },
  { title: 'Good margins for resale', body: 'Priced well for wholesale — our customers have been happy with it and repeat orders have been easy.' },
  { title: 'Solid choice for our supply chain', body: 'We have been sourcing this for a few months now. Consistent quality and the tier pricing makes it worthwhile at volume.' },
];

async function main() {
  // ── Seed Users ──
  const adminEmail = 'admin@wholesalex.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await prisma.user.create({
      data: { email: adminEmail, password: hashedPassword, firstName: 'System', lastName: 'Admin', role: UserRole.ADMIN, status: UserStatus.ACTIVE, accountType: AccountType.LOCAL, emailVerified: true },
    });
    console.log('✅ Admin user created: admin@wholesalex.com / Admin@123');
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  const vendorEmail = 'vendor@wholesalex.com';
  let vendorUser = await prisma.user.findUnique({ where: { email: vendorEmail } });
  if (!vendorUser) {
    const hashedPassword = await bcrypt.hash('Vendor@123', 10);
    vendorUser = await prisma.user.create({
      data: { email: vendorEmail, password: hashedPassword, firstName: 'Demo', lastName: 'Vendor', role: UserRole.VENDOR, status: UserStatus.ACTIVE, accountType: AccountType.LOCAL, emailVerified: true, companyName: 'Demo Vendor Pvt Ltd' },
    });
    console.log('✅ Vendor user created: vendor@wholesalex.com / Vendor@123');
  } else {
    console.log('ℹ️ Vendor user already exists');
  }

  const buyer1Email = 'buyer1@wholesalex.com';
  let buyer1 = await prisma.user.findUnique({ where: { email: buyer1Email } });
  if (!buyer1) {
    const hashedPassword = await bcrypt.hash('Buyer1@123', 10);
    buyer1 = await prisma.user.create({
      data: { email: buyer1Email, password: hashedPassword, firstName: 'Rahul', lastName: 'Sharma', role: UserRole.BUYER, status: UserStatus.ACTIVE, accountType: AccountType.LOCAL, emailVerified: true },
    });
    console.log('✅ Buyer1 user created: buyer1@wholesalex.com / Buyer1@123');
  } else {
    console.log('ℹ️ Buyer1 user already exists');
  }

  const buyer2Email = 'buyer2@wholesalex.com';
  let buyer2 = await prisma.user.findUnique({ where: { email: buyer2Email } });
  if (!buyer2) {
    const hashedPassword = await bcrypt.hash('Buyer2@123', 10);
    buyer2 = await prisma.user.create({
      data: { email: buyer2Email, password: hashedPassword, firstName: 'Priya', lastName: 'Patel', role: UserRole.BUYER, status: UserStatus.ACTIVE, accountType: AccountType.LOCAL, emailVerified: true },
    });
    console.log('✅ Buyer2 user created: buyer2@wholesalex.com / Buyer2@123');
  } else {
    console.log('ℹ️ Buyer2 user already exists');
  }

  // ── Seed Catalog: 5 categories x 10 products each (skip if orders exist that block it) ──
  await prisma.cartItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.tierPrice.deleteMany();

  let shouldSeedProducts = false;
  try {
    await prisma.orderItem.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    shouldSeedProducts = true;
  } catch {
    console.log('ℹ️ Products/categories have existing orders — skipping re-creation');
  }

  const categoriesByHandle: Record<string, { id: string }> = {};

  if (shouldSeedProducts) {
    let reviewIdx = 0;
    for (const cat of CATALOG) {
      const category = await prisma.category.create({
        data: { name: cat.name, handle: cat.handle, description: cat.description, isActive: true, rank: CATALOG.indexOf(cat) },
      });
      categoriesByHandle[cat.handle] = category;

      for (const p of cat.products) {
        const product = await prisma.product.create({
          data: {
            title: p.title,
            handle: p.handle,
            description: p.description,
            sku: p.sku,
            moq: p.moq,
            unitPrice: p.unitPrice,
            compareAtPrice: p.compareAtPrice,
            inventoryQuantity: p.inventoryQuantity,
            status: ProductStatus.PUBLISHED,
            categoryId: category.id,
            vendorId: vendorUser.id,
            vendorName: cat.vendorName,
            thumbnail: img(p.handle, 1, 400),
            images: [img(p.handle, 1), img(p.handle, 2), img(p.handle, 3)],
            tags: p.tags,
            rating: p.rating,
            reviewCount: p.reviewCount,
            tierPrices: { create: p.tiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty ?? null, price: t.price })) },
          },
        });

        const t1 = REVIEW_TEMPLATES[reviewIdx % REVIEW_TEMPLATES.length];
        const t2 = REVIEW_TEMPLATES[(reviewIdx + 1) % REVIEW_TEMPLATES.length];
        reviewIdx++;
        await prisma.review.createMany({
          data: [
            { productId: product.id, userId: buyer1.id, rating: 5, title: t1.title, body: t1.body, isVerified: true, helpful: Math.floor(p.reviewCount / 3) },
            { productId: product.id, userId: buyer2.id, rating: 4, title: t2.title, body: t2.body, isVerified: true, helpful: Math.floor(p.reviewCount / 4) },
          ],
        });
      }
    }
    console.log(`✅ Catalog created: ${CATALOG.length} categories x 10 products = ${CATALOG.reduce((s, c) => s + c.products.length, 0)} products, with reviews`);
  } else {
    // Fetch existing categories for banner/home-section references
    const existingCats = await prisma.category.findMany();
    for (const c of existingCats) categoriesByHandle[c.handle] = c;
  }

  // ── Upsert default coupon ──
  const now = new Date();
  const oneYearLater = new Date();
  oneYearLater.setFullYear(now.getFullYear() + 1);

  await prisma.coupon.upsert({
    where: { code: COUPON_CODE },
    update: {},
    create: { code: COUPON_CODE, type: 'PERCENTAGE', value: COUPON_DISCOUNT_PERCENT, isActive: true, startDate: now, endDate: oneYearLater },
  });
  console.log(`✅ Coupon upserted: ${COUPON_CODE} (${COUPON_DISCOUNT_PERCENT}% off)`);

  // ── Seed Banners (always reset) ──
  const existingBannerCount = await prisma.banner.count();
  if (existingBannerCount === 0) {
    await prisma.banner.createMany({
      data: [
        {
          title: 'Mega Wholesale Sale',
          subtitle: 'Up to 60% off on Electronics & Gadgets. Bulk orders get extra discounts!',
          imageUrl: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1400&h=500&fit=crop',
          linkUrl: '/products?categoryId=electronics',
          buttonText: 'Shop Electronics',
          section: 'hero',
          rank: 0,
          isActive: true,
        },
        {
          title: 'Fashion Bulk Deals',
          subtitle: 'Premium apparel at wholesale prices. Start ordering from just 50 units!',
          imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&h=500&fit=crop',
          linkUrl: '/products?categoryId=fashion',
          buttonText: 'Shop Fashion',
          section: 'hero',
          rank: 1,
          isActive: true,
        },
        {
          title: 'Industrial Equipment Sale',
          subtitle: 'Heavy-duty tools & machinery for your business. Tier pricing available!',
          imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f355dfd?w=1400&h=500&fit=crop',
          linkUrl: '/products?categoryId=industrial',
          buttonText: 'Shop Industrial',
          section: 'hero',
          rank: 2,
          isActive: true,
        },
        {
          title: 'Special Mid-Season Offer',
          subtitle: 'Flat ₹500 off on orders above ₹5000. Limited time deal!',
          imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed24b8c54?w=1400&h=300&fit=crop',
          linkUrl: '/products',
          buttonText: 'Grab the Deal',
          section: 'mid',
          rank: 0,
          isActive: true,
        },
      ],
    });
    console.log('✅ Banners created: 3 hero + 1 mid');
  } else {
    console.log(`ℹ️ Banners already exist (${existingBannerCount} found), skipping`);
  }

  // ── Seed Home Sections (idempotent — creates any that are missing, leaves existing ones alone) ──
  const desiredSections: { type: string; title: string; subtitle?: string; config: any; categoryHandle?: string | null }[] = [
    { type: 'announcement', title: 'Announcement Bar', config: { message: '🎉 Free shipping on orders above ₹10,000! Use code DEEPANSHU for 10% off.' }, categoryHandle: null },
    { type: 'hero_carousel', title: 'Hero Banner Carousel', config: {}, categoryHandle: null },
    { type: 'category_icons', title: 'Shop by Category', config: {}, categoryHandle: null },
    { type: 'top_selling', title: 'Top Selling Electronics', config: { limit: 8 }, categoryHandle: 'electronics' },
    { type: 'top_selling', title: 'Top Selling Fashion', config: { limit: 8 }, categoryHandle: 'fashion' },
    { type: 'top_selling', title: 'Top Selling Industrial', config: { limit: 8 }, categoryHandle: 'industrial' },
    { type: 'top_selling', title: 'Top Selling Home & Kitchen', config: { limit: 8 }, categoryHandle: 'home-kitchen' },
    { type: 'top_selling', title: 'Top Selling Health & Beauty', config: { limit: 8 }, categoryHandle: 'health-beauty' },
    {
      type: 'trust_badges',
      title: 'Why Choose Us',
      config: { items: [
        { icon: 'Truck', label: 'Pan-India Delivery', description: 'Reliable shipping across India' },
        { icon: 'Shield', label: 'Secure Payments', description: '100% secure transactions' },
        { icon: 'RefreshCw', label: 'Easy Returns', description: '7-day hassle-free returns' },
        { icon: 'Headphones', label: '24/7 Support', description: 'Dedicated customer support' },
      ]},
      categoryHandle: null,
    },
    { type: 'shop_by_category', title: 'Shop by Category', subtitle: 'Explore our wide range of wholesale categories', config: { columns: 4 }, categoryHandle: null },
    {
      type: 'cta',
      title: 'Ready to Buy in Bulk?',
      subtitle: 'Get the best wholesale prices with tier discounts and free delivery.',
      config: {
        headline: 'Ready to Buy in Bulk?',
        subtext: 'Get the best wholesale prices with tier discounts and free delivery.',
        ctaText: 'Browse Products',
        ctaLink: '/products',
        ctaText2: 'Request a Quote',
        ctaLink2: '/rfqs/new',
      },
      categoryHandle: null,
    },
  ];

  let createdSections = 0;
  for (let i = 0; i < desiredSections.length; i++) {
    const s = desiredSections[i];
    const categoryId = s.categoryHandle ? categoriesByHandle[s.categoryHandle]?.id ?? null : null;
    const existing = await prisma.homeSection.findFirst({ where: { type: s.type, categoryId } });
    if (!existing) {
      await prisma.homeSection.create({
        data: {
          type: s.type,
          title: s.title,
          subtitle: s.subtitle,
          config: s.config,
          rank: i,
          isActive: true,
          categoryId,
        },
      });
      createdSections++;
    }
  }
  console.log(createdSections > 0 ? `✅ Home sections created: ${createdSections} new section(s)` : 'ℹ️ Home sections already up to date');

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
