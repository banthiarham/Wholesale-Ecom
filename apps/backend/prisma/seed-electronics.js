/* eslint-disable */
/**
 * Local demo data: an electronics wholesale trader.
 *
 * WIPES the database (orders, products, users, rules, …) and loads fresh sample data. Kept as-is:
 *   - the admin login (ADMIN_EMAIL below), site branding / SMTP settings, delivery partners,
 *   - online payment gateways (CCAvenue / Razorpay / Stripe / PayU rows), since they hold real API keys.
 *
 * Run inside the backend container (it needs @prisma/client and bcrypt from /app/node_modules):
 *   docker cp apps/backend/prisma/seed-electronics.js wholesale-backend-1:/app/prisma/
 *   docker exec wholesale-backend-1 node prisma/seed-electronics.js --yes
 *
 * Every sample customer can sign in with SAMPLE_PASSWORD.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@wholesalex.com';
const SAMPLE_PASSWORD = 'Demo@Electro2026';
const ONLINE_GATEWAYS = ['CCAVENUE', 'RAZORPAY', 'STRIPE', 'PAYU'];

const img = (id) => `https://images.unsplash.com/photo-${id}?w=800&q=80`;
const r0 = (n) => Math.round(n);

// ── Categories ──
const CATEGORIES = [
  { key: 'mobiles', name: 'Mobiles & Tablets', handle: 'mobiles-tablets', description: 'Smartphones, tablets and mobile charging accessories from leading brands.', image: img('1511707171634-5f897ff02aa9') },
  { key: 'audio', name: 'Audio', handle: 'audio', description: 'Headphones, true-wireless earbuds and speakers.', image: img('1505740420928-5e560c06d30e') },
  { key: 'computers', name: 'Computers & Peripherals', handle: 'computers-peripherals', description: 'Laptops, desktops, keyboards, mice and printers for retail and office supply.', image: img('1496181133206-80ce9b88a853') },
  { key: 'smart', name: 'Smart Devices & Wearables', handle: 'smart-devices-wearables', description: 'Smartwatches, smart TVs, smart-home devices, cameras and gaming consoles.', image: img('1546868871-7041f2a55e12') },
];

// ── Products: price = wholesale price per unit excluding GST; mrp = list price excluding GST ──
// tiers: [qty for tier 1, qty for tier 2] → 3% and 6% off the price.
const PRODUCTS = [
  // Mobiles & Tablets
  { cat: 'mobiles', brand: 'Apple', title: 'Apple iPhone 15 (128GB, Black)', sku: 'MOB-APL-IP15-128', price: 61500, mrp: 67700, moq: 2, stock: 60, tiers: [10, 25], photo: '1511707171634-5f897ff02aa9', rating: 4.7, reviews: 38, tags: ['best-seller'], desc: '6.1-inch Super Retina XDR display, A16 Bionic chip, 48MP main camera, USB-C. Sealed box with 1-year Apple India warranty.' },
  { cat: 'mobiles', brand: 'Apple', title: 'Apple iPhone 15 Pro (256GB, Natural Titanium)', sku: 'MOB-APL-IP15P-256', price: 108000, mrp: 122000, moq: 1, stock: 18, tiers: [5, 15], photo: '1574944985070-8f3ebc6b79d2', rating: 4.8, reviews: 21, tags: [], desc: 'Titanium design, A17 Pro chip, 48MP Pro camera system with 3x telephoto. Sealed box, Apple India warranty.' },
  { cat: 'mobiles', brand: 'Apple', title: 'Apple iPhone 14 (128GB, Midnight)', sku: 'MOB-APL-IP14-128', price: 51800, mrp: 59200, moq: 2, stock: 45, tiers: [10, 25], photo: '1592899677977-9c10ca588bbd', rating: 4.6, reviews: 44, tags: [], desc: '6.1-inch display, A15 Bionic chip, dual 12MP camera, Crash Detection. Sealed box with Apple India warranty.' },
  { cat: 'mobiles', brand: 'Xiaomi', title: 'Redmi Note 13 5G (6GB/128GB)', sku: 'MOB-XIA-RN13-6128', price: 14900, mrp: 17800, moq: 5, stock: 240, tiers: [20, 50], photo: '1609091839311-d5365f9ff1c5', rating: 4.3, reviews: 112, tags: ['best-seller'], desc: '6.67-inch 120Hz AMOLED, Dimensity 6080, 108MP camera, 5000mAh battery with 33W charging.' },
  { cat: 'mobiles', brand: 'Samsung', title: 'Samsung Galaxy A35 5G (8GB/128GB)', sku: 'MOB-SAM-A35-8128', price: 25200, mrp: 28800, moq: 3, stock: 150, tiers: [20, 50], photo: '1546054454-aa26e2b734c7', rating: 4.4, reviews: 67, tags: [], desc: '6.6-inch Super AMOLED 120Hz, Exynos 1380, 50MP OIS camera, IP67, 4 OS upgrades.' },
  { cat: 'mobiles', brand: 'OnePlus', title: 'OnePlus Nord CE4 5G (8GB/128GB)', sku: 'MOB-OPL-CE4-8128', price: 20200, mrp: 21900, moq: 3, stock: 130, tiers: [20, 50], photo: '1600087626014-e652e18bbff2', rating: 4.4, reviews: 58, tags: [], desc: 'Snapdragon 7 Gen 3, 120Hz AMOLED, 5500mAh battery with 100W SUPERVOOC charging.' },
  { cat: 'mobiles', brand: 'Samsung', title: 'Samsung Galaxy M15 5G (4GB/128GB)', sku: 'MOB-SAM-M15-4128', price: 10600, mrp: 12700, moq: 5, stock: 300, tiers: [25, 100], photo: '1544866092-1935c5ef2a8f', rating: 4.2, reviews: 95, tags: [], desc: '6.5-inch sAMOLED, Dimensity 6100+, 6000mAh battery, 50MP triple camera.' },
  { cat: 'mobiles', brand: 'Apple', title: 'Apple iPad 10th Gen (Wi-Fi, 64GB)', sku: 'TAB-APL-IPAD10-64', price: 29400, mrp: 33800, moq: 2, stock: 40, tiers: [10, 25], photo: '1544244015-0df4b3ffc6b0', rating: 4.6, reviews: 26, tags: [], desc: '10.9-inch Liquid Retina display, A14 Bionic, USB-C, landscape 12MP front camera.' },
  { cat: 'mobiles', brand: 'Ambrane', title: 'Ambrane 65W GaN Fast Charger with Type-C Cable', sku: 'ACC-AMB-GAN65', price: 1040, mrp: 1690, moq: 10, stock: 1200, tiers: [50, 200], photo: '1583863788434-e58a36330cf0', rating: 4.3, reviews: 210, tags: ['best-seller'], desc: '65W GaN charger with PD 3.0 / QC 3.0, charges laptops and phones. Includes 1m braided Type-C to Type-C cable.' },

  // Audio
  { cat: 'audio', brand: 'boAt', title: 'boAt Rockerz 550 Wireless Headphones', sku: 'AUD-BOT-RKZ550', price: 1480, mrp: 3380, moq: 10, stock: 600, tiers: [50, 200], photo: '1505740420928-5e560c06d30e', rating: 4.2, reviews: 320, tags: ['best-seller'], desc: 'Over-ear Bluetooth headphones, 50mm drivers, 20 hours playback, soft padded ear cushions.' },
  { cat: 'audio', brand: 'Sony', title: 'Sony WH-1000XM5 Noise Cancelling Headphones', sku: 'AUD-SNY-XM5', price: 22800, mrp: 29600, moq: 2, stock: 35, tiers: [10, 25], photo: '1618366712010-f4ae9c647dcb', rating: 4.8, reviews: 41, tags: [], desc: 'Industry-leading ANC, 30 hours battery, multipoint Bluetooth, speak-to-chat.' },
  { cat: 'audio', brand: 'JBL', title: 'JBL Tune 760NC Wireless Headphones', sku: 'AUD-JBL-T760NC', price: 4620, mrp: 6770, moq: 5, stock: 180, tiers: [25, 100], photo: '1585298723682-7115561c51b7', rating: 4.3, reviews: 88, tags: [], desc: 'Active noise cancelling, JBL Pure Bass sound, 35 hours battery, foldable design.' },
  { cat: 'audio', brand: 'Sony', title: 'Sony WH-CH720N Wireless Headphones', sku: 'AUD-SNY-CH720N', price: 6350, mrp: 8460, moq: 5, stock: 90, tiers: [25, 100], photo: '1550009158-9ebf69173e03', rating: 4.4, reviews: 52, tags: [], desc: 'Lightweight ANC headphones, 35 hours battery, quick charge, multipoint connection.' },
  { cat: 'audio', brand: 'Zebronics', title: 'Zebronics Zeb-Thunder Wired Headphones', sku: 'AUD-ZEB-THNDR', price: 510, mrp: 840, moq: 20, stock: 900, tiers: [100, 300], photo: '1583394838336-acd977736f90', rating: 4.0, reviews: 145, tags: [], desc: 'On-ear wired headphones with mic, 40mm drivers, 3.5mm jack, adjustable headband.' },
  { cat: 'audio', brand: 'boAt', title: 'boAt Airdopes 141 TWS Earbuds', sku: 'AUD-BOT-AD141', price: 850, mrp: 3380, moq: 20, stock: 1500, tiers: [100, 300], photo: '1606220945770-b5b6c2c55bf1', rating: 4.1, reviews: 410, tags: ['best-seller'], desc: 'True wireless earbuds, 42 hours playback, ENx noise cancellation for calls, IPX4.' },
  { cat: 'audio', brand: 'Apple', title: 'Apple AirPods Pro (2nd Gen) with USB-C', sku: 'AUD-APL-APP2', price: 18900, mrp: 21100, moq: 2, stock: 70, tiers: [10, 25], photo: '1572569511254-d8f925fe2cbb', rating: 4.7, reviews: 63, tags: [], desc: 'Active noise cancellation, Adaptive Audio, personalised spatial audio, MagSafe USB-C case.' },
  { cat: 'audio', brand: 'Apple', title: 'Apple AirPods (3rd Gen) with Lightning Case', sku: 'AUD-APL-AP3', price: 14100, mrp: 16000, moq: 2, stock: 55, tiers: [10, 25], photo: '1600294037681-c80b4cb5b434', rating: 4.5, reviews: 34, tags: [], desc: 'Spatial audio with dynamic head tracking, sweat and water resistant, up to 30 hours with case.' },
  { cat: 'audio', brand: 'Noise', title: 'Noise Buds VS104 TWS Earbuds', sku: 'AUD-NOI-VS104', price: 770, mrp: 2540, moq: 20, stock: 1100, tiers: [100, 300], photo: '1590658268037-6bf12165a8df', rating: 4.0, reviews: 260, tags: [], desc: 'Up to 45 hours playtime, quad-mic ENC, instacharge, low-latency mode.' },
  { cat: 'audio', brand: 'JBL', title: 'JBL Flip 6 Portable Bluetooth Speaker', sku: 'AUD-JBL-FLIP6', price: 8800, mrp: 11800, moq: 3, stock: 75, tiers: [15, 40], photo: '1608043152269-423dbba4e7e1', rating: 4.6, reviews: 72, tags: ['best-seller'], desc: 'Bold JBL Original Pro Sound, IP67 waterproof and dustproof, 12 hours playtime.' },
  { cat: 'audio', brand: 'Edifier', title: 'Edifier R1280DB Bookshelf Speakers', sku: 'AUD-EDF-R1280DB', price: 8100, mrp: 10100, moq: 2, stock: 40, tiers: [10, 25], photo: '1545454675-3531b543be5d', rating: 4.5, reviews: 29, tags: [], desc: 'Active 2.0 bookshelf speakers, Bluetooth, optical and coaxial inputs, wooden enclosure, remote.' },

  // Computers & Peripherals
  { cat: 'computers', brand: 'HP', title: 'HP 15s Laptop (Ryzen 5 7520U, 16GB, 512GB SSD)', sku: 'CMP-HP-15S-R5', price: 40800, mrp: 50000, moq: 2, stock: 55, tiers: [10, 25], photo: '1496181133206-80ce9b88a853', rating: 4.3, reviews: 47, tags: ['best-seller'], desc: '15.6-inch FHD anti-glare display, Windows 11 Home, MS Office Home & Student 2021, 1.69 kg.' },
  { cat: 'computers', brand: 'Apple', title: 'Apple MacBook Air 13" M2 (8GB, 256GB)', sku: 'CMP-APL-MBA-M2', price: 77500, mrp: 84600, moq: 1, stock: 25, tiers: [5, 15], photo: '1517336714731-489689fd1ca8', rating: 4.8, reviews: 36, tags: [], desc: '13.6-inch Liquid Retina display, Apple M2 chip, up to 18 hours battery, MagSafe charging.' },
  { cat: 'computers', brand: 'Lenovo', title: 'Lenovo IdeaPad Slim 3 (Core i5 12th Gen, 16GB, 512GB)', sku: 'CMP-LNV-IPS3-I5', price: 46200, mrp: 59200, moq: 2, stock: 48, tiers: [10, 25], photo: '1593642632823-8f785ba67e45', rating: 4.4, reviews: 39, tags: [], desc: '15.6-inch FHD IPS display, Intel Core i5-12450H, Windows 11, backlit keyboard.' },
  { cat: 'computers', brand: 'Dell', title: 'Dell Inspiron 3520 (Core i3 12th Gen, 8GB, 512GB)', sku: 'CMP-DEL-3520-I3', price: 33900, mrp: 42300, moq: 2, stock: 70, tiers: [10, 25], photo: '1588872657578-7efd1f1555ed', rating: 4.2, reviews: 51, tags: [], desc: '15.6-inch FHD 120Hz display, Intel Core i3-1215U, Windows 11 + Office 2021.' },
  { cat: 'computers', brand: 'Apple', title: 'Apple iMac 24" M3 (8GB, 256GB)', sku: 'CMP-APL-IMAC-M3', price: 112500, mrp: 126900, moq: 1, stock: 12, tiers: [3, 10], photo: '1527443224154-c4a3942d3acf', rating: 4.7, reviews: 14, tags: [], desc: '24-inch 4.5K Retina display, Apple M3 chip, 1080p FaceTime camera, Magic Keyboard and Mouse included.' },
  { cat: 'computers', brand: 'Apple', title: 'Apple Magic Keyboard (USB-C)', sku: 'CMP-APL-MKB', price: 7900, mrp: 8400, moq: 3, stock: 60, tiers: [15, 40], photo: '1587829741301-dc798b83add3', rating: 4.5, reviews: 22, tags: [], desc: 'Wireless rechargeable keyboard for Mac and iPad, USB-C charging, about a month per charge.' },
  { cat: 'computers', brand: 'Cosmic Byte', title: 'Cosmic Byte CB-GK-26 Mechanical Keyboard', sku: 'CMP-CSB-GK26', price: 2400, mrp: 3800, moq: 5, stock: 220, tiers: [25, 100], photo: '1625948515291-69613efd103f', rating: 4.2, reviews: 98, tags: [], desc: 'TKL mechanical keyboard, hot-swappable switches, PBT keycaps, USB-C detachable cable.' },
  { cat: 'computers', brand: 'Logitech', title: 'Logitech M331 Silent Plus Wireless Mouse', sku: 'CMP-LOG-M331', price: 740, mrp: 1350, moq: 10, stock: 800, tiers: [50, 200], photo: '1527864550417-7fd91fc51a46', rating: 4.4, reviews: 340, tags: ['best-seller'], desc: '90% less click noise, 2.4 GHz nano receiver, 24-month battery life.' },
  { cat: 'computers', brand: 'Logitech', title: 'Logitech G304 Lightspeed Wireless Gaming Mouse', sku: 'CMP-LOG-G304', price: 2200, mrp: 3300, moq: 5, stock: 260, tiers: [25, 100], photo: '1615663245857-ac93bb7c39e7', rating: 4.5, reviews: 175, tags: [], desc: 'HERO 12K sensor, Lightspeed wireless, 6 programmable buttons, 250-hour battery.' },
  { cat: 'computers', brand: 'HP', title: 'HP Color Laser MFP 179fnw Printer', sku: 'CMP-HP-179FNW', price: 21600, mrp: 27900, moq: 1, stock: 20, tiers: [5, 15], photo: '1612815154858-60aa4c59eaa6', rating: 4.1, reviews: 18, tags: [], desc: 'Colour laser print, scan, copy and fax; Wi-Fi and Ethernet; 40-sheet ADF.' },

  // Smart Devices & Wearables
  { cat: 'smart', brand: 'Apple', title: 'Apple Watch Series 9 GPS 45mm', sku: 'WRB-APL-S9-45', price: 36200, mrp: 37200, moq: 2, stock: 30, tiers: [10, 25], photo: '1546868871-7041f2a55e12', rating: 4.7, reviews: 27, tags: [], desc: 'S9 chip, double-tap gesture, always-on Retina display, ECG and blood-oxygen apps.' },
  { cat: 'smart', brand: 'Apple', title: 'Apple Watch SE GPS 44mm (Sport Loop)', sku: 'WRB-APL-SE-44', price: 25000, mrp: 27100, moq: 2, stock: 45, tiers: [10, 25], photo: '1631281956016-3cdc1b2fe5fb', rating: 4.6, reviews: 33, tags: [], desc: 'Crash Detection, fitness and sleep tracking, swim-proof, Sport Loop band.' },
  { cat: 'smart', brand: 'Noise', title: 'Noise ColorFit Pro 5 Smartwatch', sku: 'WRB-NOI-CFP5', price: 2500, mrp: 5930, moq: 10, stock: 500, tiers: [50, 200], photo: '1523275335684-37898b6baf30', rating: 4.1, reviews: 230, tags: ['best-seller'], desc: '1.85-inch AMOLED display, Bluetooth calling, 100+ sports modes, 7-day battery.' },
  { cat: 'smart', brand: 'Samsung', title: 'Samsung 55" Crystal 4K UHD Smart TV', sku: 'TV-SAM-55CU8000', price: 39500, mrp: 55800, moq: 1, stock: 22, tiers: [5, 15], photo: '1593359677879-a4bb92f829d1', rating: 4.4, reviews: 31, tags: [], desc: '55-inch 4K UHD, Crystal Processor 4K, Tizen smart TV with built-in voice assistants.' },
  { cat: 'smart', brand: 'Google', title: 'Google Nest Mini (2nd Gen) Smart Speaker', sku: 'SMH-GGL-NESTMINI', price: 2850, mrp: 3800, moq: 5, stock: 160, tiers: [25, 100], photo: '1558089687-f282ffcbc126', rating: 4.3, reviews: 64, tags: [], desc: 'Google Assistant smart speaker, controls compatible smart-home devices, wall-mountable.' },
  { cat: 'smart', brand: 'Qubo', title: 'Qubo Smart Door Lock Essential', sku: 'SMH-QUB-LOCK', price: 9200, mrp: 13500, moq: 2, stock: 35, tiers: [10, 25], photo: '1558002038-1055907df827', rating: 4.0, reviews: 19, tags: [], desc: '5-way unlocking: fingerprint, PIN, app, RFID card and mechanical key. Low-battery alerts.' },
  { cat: 'smart', brand: 'Sony', title: 'Sony Alpha ZV-E10 Mirrorless Camera (16-50mm Kit)', sku: 'CAM-SNY-ZVE10', price: 51500, mrp: 66600, moq: 1, stock: 15, tiers: [5, 15], photo: '1516035069371-29a1b244cc32', rating: 4.6, reviews: 24, tags: [], desc: '24.2MP APS-C sensor, 4K video, flip screen, product-showcase mode for creators.' },
  { cat: 'smart', brand: 'Nikon', title: 'Nikon D7500 DSLR with 18-140mm VR Lens', sku: 'CAM-NIK-D7500', price: 87500, mrp: 101600, moq: 1, stock: 0, tiers: [3, 10], photo: '1564466809058-bf4114d55352', rating: 4.7, reviews: 12, tags: [], desc: '20.9MP DX-format sensor, 8 fps, 4K UHD video, tilting touchscreen.' },
  { cat: 'smart', brand: 'Sony', title: 'Sony PlayStation 5 Slim (Disc Edition)', sku: 'GAM-SNY-PS5S', price: 46000, mrp: 46600, moq: 1, stock: 8, tiers: [5, 15], photo: '1606813907291-d86efa9b94db', rating: 4.8, reviews: 40, tags: ['best-seller'], desc: '1TB SSD, 4K gaming up to 120fps, DualSense wireless controller included.' },
];

// ── Custom roles (role-based pricing): discount off the base price per minimum quantity ──
const ROLES = [
  { name: 'retailer', label: 'Retailer', color: '#2563EB', icon: 'store', description: 'Mobile & electronics shops buying for their own counter.', tiers: [{ minQty: 1, off: 0.03 }] },
  { name: 'wholesaler', label: 'Wholesaler', color: '#7C3AED', icon: 'warehouse', description: 'Wholesale traders supplying retailers in their city.', tiers: [{ minQty: 1, off: 0.06 }, { minQty: 'tier1', off: 0.09 }] },
  { name: 'distributor', label: 'Distributor', color: '#059669', icon: 'truck', description: 'Regional distributors with credit terms.', tiers: [{ minQty: 1, off: 0.1 }, { minQty: 'tier2', off: 0.14 }] },
];

// ── Customers ──
const USERS = [
  { email: 'amit.agarwal@example.com', firstName: 'Amit', lastName: 'Agarwal', phone: '9829012345', role: 'BUYER', customRole: 'retailer', company: 'Agarwal Mobile Hub', gstin: '08AAKPA4521M1Z3', pan: 'AAKPA4521M', street: 'Shop 14, Ganpati Plaza, MI Road', city: 'Jaipur', state: 'Rajasthan', zip: '302001' },
  { email: 'neha.gupta@example.com', firstName: 'Neha', lastName: 'Gupta', phone: '9811023456', role: 'BUYER', customRole: 'wholesaler', company: 'Gupta Electronics Traders', gstin: '07AAGFG7788K1Z9', pan: 'AAGFG7788K', street: '2241, Lajpat Rai Market, Chandni Chowk', city: 'Delhi', state: 'Delhi', zip: '110006', creditLimit: 200000 },
  { email: 'vikram.mehta@example.com', firstName: 'Vikram', lastName: 'Mehta', phone: '9824034567', role: 'DISTRIBUTOR', customRole: 'distributor', company: 'Mehta Distributors Pvt Ltd', gstin: '24AAICM3344Q1Z1', pan: 'AAICM3344Q', street: '5th Floor, Shivalik Shilp, Iscon Cross Road', city: 'Ahmedabad', state: 'Gujarat', zip: '380015', creditLimit: 500000 },
  { email: 'suresh.patel@example.com', firstName: 'Suresh', lastName: 'Patel', phone: '9820045678', role: 'BUYER', customRole: null, company: 'Patel Computers', gstin: '27AAEPP9012L1Z6', pan: 'AAEPP9012L', street: '12, Lamington Road, Grant Road East', city: 'Mumbai', state: 'Maharashtra', zip: '400007' },
];

const INVOICE_TERMS = [
  'Goods once sold will not be taken back or exchanged.',
  'Warranty is provided by the respective brand / manufacturer; claims must be made at their authorised service centres.',
  'Dead-on-arrival (DOA) units must be reported within 48 hours of delivery with the unopened box.',
  'Payment due within 15 days of invoice date; overdue amounts attract 18% p.a. interest.',
  'All disputes are subject to Jaipur jurisdiction only.',
].join('\n');

async function wipe() {
  const keepTables = new Set(['_prisma_migrations', 'User', 'Role', 'Permission', 'RolePermission', 'SiteSetting', 'SmtpSettings', 'PaymentGateway', 'HomeSection', 'DeliveryPartner']);
  const tables = (await prisma.$queryRawUnsafe(`select tablename from pg_tables where schemaname = 'public'`)).map((r) => r.tablename);
  await prisma.$transaction(async (tx) => {
    // Delete without cascading so nothing outside this list is touched (home sections, settings, …).
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
    for (const t of tables) if (!keepTables.has(t)) await tx.$executeRawUnsafe(`DELETE FROM "${t}"`);
    await tx.$executeRawUnsafe(`DELETE FROM "User" WHERE email <> $1`, ADMIN_EMAIL);
    await tx.$executeRawUnsafe(`UPDATE "User" SET "roleId" = NULL`);
    await tx.$executeRawUnsafe(`DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT id FROM "Role" WHERE "isSystem" = false)`);
    await tx.$executeRawUnsafe(`DELETE FROM "Role" WHERE "isSystem" = false`);
    await tx.$executeRawUnsafe(`DELETE FROM "PaymentGateway" WHERE provider <> ALL($1::text[])`, ONLINE_GATEWAYS);
    // Product sections point at the old categories; they are recreated below.
    await tx.$executeRawUnsafe(`DELETE FROM "HomeSection" WHERE "categoryId" IS NOT NULL OR type = 'top_selling'`);
  }, { timeout: 60000 });
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('This deletes all orders, products, users (except the admin) and rules. Re-run with --yes to continue.');
    process.exit(1);
  }
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error(`Admin user ${ADMIN_EMAIL} not found — refusing to wipe.`);

  await wipe();
  console.log('wiped');

  // Categories
  const cat = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await prisma.category.create({ data: { name: c.name, handle: c.handle, description: c.description, image: c.image, rank: i, isActive: true } });
    cat[c.key] = row;
  }

  // Products (+ tier prices)
  const product = {};
  for (const p of PRODUCTS) {
    const handle = p.title.toLowerCase().replace(/["()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const [t1, t2] = p.tiers;
    const row = await prisma.product.create({
      data: {
        title: p.title, handle, sku: p.sku, description: p.desc,
        unitPrice: p.price, compareAtPrice: p.mrp, moq: p.moq,
        status: 'PUBLISHED', inventoryQuantity: p.stock,
        images: [img(p.photo)], thumbnail: img(p.photo),
        companyName: p.brand, vendorName: 'Wholesale Center', tags: [p.brand.toLowerCase(), ...p.tags],
        rating: p.rating, reviewCount: p.reviews,
        categoryId: cat[p.cat].id, categories: { connect: [{ id: cat[p.cat].id }] },
        tierPrices: { create: [
          { minQty: t1, maxQty: t2 - 1, price: r0(p.price * 0.97) },
          { minQty: t2, maxQty: null, price: r0(p.price * 0.94) },
        ] },
      },
    });
    product[p.sku] = { ...row, def: p };
  }
  console.log(`products: ${PRODUCTS.length}`);

  // Roles + role prices
  const role = {};
  for (const r of ROLES) {
    role[r.name] = await prisma.role.create({ data: { name: r.name, label: r.label, description: r.description, color: r.color, icon: r.icon } });
    const rows = [];
    for (const p of Object.values(product)) {
      for (const t of r.tiers) {
        const minQty = t.minQty === 'tier1' ? p.def.tiers[0] : t.minQty === 'tier2' ? p.def.tiers[1] : Math.max(1, p.def.moq);
        rows.push({ productId: p.id, roleId: role[r.name].id, minQty, price: r0(p.def.price * (1 - t.off)), isActive: true });
      }
    }
    await prisma.rolePrice.createMany({ data: rows, skipDuplicates: true });
  }

  // Customers
  const hash = await bcrypt.hash(SAMPLE_PASSWORD, 10);
  for (const u of USERS) {
    const user = await prisma.user.create({
      data: {
        email: u.email, password: hash, firstName: u.firstName, lastName: u.lastName, phone: u.phone,
        role: u.role, roleId: u.customRole ? role[u.customRole].id : null,
        status: 'ACTIVE', emailVerified: true, phoneVerified: true,
        companyName: u.company, organizationName: u.company, contactPersonName: `${u.firstName} ${u.lastName}`,
        companyAddress: `${u.street}, ${u.city}, ${u.state} ${u.zip}`, gstin: u.gstin, taxId: u.gstin, panNumber: u.pan,
        city: u.city, state: u.state, pincode: u.zip,
        addresses: { create: [{ label: 'Shop / Office', street: u.street, city: u.city, state: u.state, zip: u.zip, country: 'India', isDefault: true }] },
        wallet: { create: { balance: 0, creditLimit: u.creditLimit || 0 } },
        loyalty: { create: { points: 0, tier: 'bronze' } },
      },
    });
    u.id = user.id;
  }
  console.log(`users: ${USERS.length}`);

  // Payment gateways (offline ones; online gateways with real keys were kept)
  const bank1 = await prisma.paymentGateway.create({ data: {
    provider: 'BANK_TRANSFER', label: 'Bank Transfer', description: 'NEFT / RTGS / IMPS to our HDFC current account', isActive: true, isDefault: true, testMode: false,
    settings: { bankName: 'HDFC Bank', accountName: 'Wholesale Center Electronics', accountNumber: '50200071234567', ifscCode: 'HDFC0000123', branch: 'MI Road, Jaipur' },
  } });
  await prisma.paymentGateway.create({ data: {
    provider: 'BANK_TRANSFER', label: 'Bank Transfer', description: 'NEFT / RTGS / IMPS to our ICICI current account', isActive: true, testMode: false,
    settings: { bankName: 'ICICI Bank', accountName: 'Wholesale Center Electronics', accountNumber: '012305004567', ifscCode: 'ICIC0000123', branch: 'C-Scheme, Jaipur' },
  } });
  await prisma.paymentGateway.create({ data: {
    provider: 'UPI', label: 'UPI', description: 'Scan the QR code or pay to our UPI ID', isActive: true, testMode: false,
    settings: { upiId: 'wholesalecenter@okhdfcbank', payeeName: 'Wholesale Center Electronics', qrImage: '/uploads/payment-qr/sample-upi-qr.png' },
  } });
  await prisma.paymentGateway.create({ data: { provider: 'COD', label: 'Cash on Delivery', description: 'Pay in cash or by cheque when the goods arrive', isActive: true, testMode: false } });
  if (!(await prisma.paymentGateway.findFirst({ where: { provider: 'RAZORPAY' } }))) {
    // No keys: shows up under Payment Gateways ready for test keys, but stays off until they are added.
    await prisma.paymentGateway.create({ data: { provider: 'RAZORPAY', label: 'Razorpay', description: 'Cards, netbanking, UPI and wallets', isActive: false, testMode: true } });
  }

  // Dynamic rules: GST, shipping, discounts, buy X get Y
  const ids = (skus) => skus.map((s) => product[s].id);
  const rules = [
    { name: 'GST 18% on electronics', type: 'TAX_RULE', priority: 0, description: 'Standard GST on all electronics (CGST + SGST within Rajasthan, IGST outside).', conditions: { productIds: [], categoryIds: [] }, actions: { taxRate: 18, taxLabel: 'GST', taxType: 'CGST_SGST' } },
    { name: 'Free shipping above ₹50,000', type: 'SHIPPING_RULE', priority: 1, conditions: { minOrderValue: 50000 }, actions: { shippingType: 'FREE' } },
    { name: 'Standard shipping ₹499', type: 'SHIPPING_RULE', priority: 2, conditions: { minOrderValue: 0 }, actions: { shippingType: 'FLAT_RATE', flatRate: 499 } },
    { name: 'Audio bulk discount', type: 'QUANTITY_BASED_DISCOUNT', priority: 3, description: 'Extra 3% off from 50 units, 5% off from 200 units of any audio product.', conditions: { productIds: [], categoryIds: [cat.audio.id] }, actions: { tiers: [{ minQty: 50, discountType: 'PERCENTAGE', discountValue: 3 }, { minQty: 200, discountType: 'PERCENTAGE', discountValue: 5 }] }, badgeLabel: 'Bulk Saver', badgeColor: '#0EA5E9' },
    { name: 'Festive deal on smartwatches', type: 'PRODUCT_DISCOUNT', priority: 4, description: '8% off when buying 10 or more.', conditions: { productIds: ids(['WRB-APL-S9-45', 'WRB-APL-SE-44', 'WRB-NOI-CFP5']), categoryIds: [], minQty: 10 }, actions: { discountType: 'PERCENTAGE', discountValue: 8 }, badgeLabel: 'Festive Deal', badgeColor: '#DC2626' },
    { name: 'Buy 50 chargers, get 5 free', type: 'BOGO', priority: 5, conditions: { buyProductId: product['ACC-AMB-GAN65'].id, buyQuantity: 50 }, actions: { freeProductId: product['ACC-AMB-GAN65'].id, freeQuantity: 5 }, badgeLabel: 'Buy 50 Get 5', badgeColor: '#7C3AED' },
    { name: '2% off orders above ₹2,00,000', type: 'CART_DISCOUNT', priority: 6, conditions: { minSubtotal: 200000 }, actions: { discountType: 'PERCENTAGE', discountValue: 2 } },
    { name: '1% off on bank transfer', type: 'PAYMENT_METHOD_DISCOUNT', priority: 7, conditions: { paymentMethod: 'BANK_TRANSFER' }, actions: { discountType: 'PERCENTAGE', discountValue: 1 } },
  ];
  for (const r of rules) await prisma.dynamicRule.create({ data: { ...r, isActive: true, createdBy: admin.id } });
  console.log(`rules: ${rules.length}`);

  // Settings: invoice + seller details printed on invoices
  const settings = [
    ['invoiceTerms', INVOICE_TERMS, 'Invoice Terms & Conditions', 'invoice'],
    ['invoiceDeliveryTerms', 'Ex-Godown Jaipur. Door delivery in 3–5 working days; freight as per invoice.', 'Invoice Terms of Delivery', 'invoice'],
    ['invoiceBankGatewayId', bank1.id, 'Invoice Bank Account', 'invoice'],
    ['invoiceLogoUrl', '', 'Invoice Logo', 'invoice'],
    ['businessState', 'Rajasthan', 'Business State (for GST)', 'commerce'],
    ['businessAddress', 'B-12, Electronics Market, Sindhi Camp, Jaipur, Rajasthan 302006', 'Business Address', 'commerce'],
    ['businessGstin', '08AABCW1234E1Z2', 'Business GSTIN', 'commerce'],
    ['heroHeadline', 'Electronics at Wholesale Prices', 'Hero Headline', 'homepage'],
    ['heroSubtext', 'Mobiles, audio, laptops and smart devices from top brands — tier pricing, GST invoices and fast dispatch.', 'Hero Subtext', 'homepage'],
  ];
  for (const [key, value, label, group] of settings) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value, label, group, type: 'text' } });
  }

  // Homepage: banners + a product section per category
  await prisma.banner.createMany({ data: [
    { title: 'Smartphones in Bulk', subtitle: 'Apple, Samsung, OnePlus & Redmi at dealer prices', imageUrl: img('1592899677977-9c10ca588bbd'), linkUrl: `/categories/${cat.mobiles.handle}`, buttonText: 'Shop Mobiles', rank: 0, section: 'hero' },
    { title: 'Audio Mega Stock', subtitle: 'Headphones, TWS & speakers — extra 5% off on 200+ units', imageUrl: img('1550009158-9ebf69173e03'), linkUrl: `/categories/${cat.audio.handle}`, buttonText: 'Shop Audio', rank: 1, section: 'hero' },
    { title: 'Laptops & Peripherals', subtitle: 'Stock up for the back-to-office season', imageUrl: img('1601524909162-ae8725290836'), linkUrl: `/categories/${cat.computers.handle}`, buttonText: 'Shop Computers', rank: 2, section: 'hero' },
    { title: 'Free shipping above ₹50,000', subtitle: 'Plus 1% off when you pay by bank transfer', imageUrl: img('1498049794561-7780e7231661'), linkUrl: '/products', buttonText: 'Browse Products', rank: 0, section: 'mid' },
  ] });
  await prisma.homeSection.updateMany({ where: { type: 'announcement' }, data: { config: { message: '⚡ Free shipping on orders above ₹50,000 · 1% off on bank transfer payments' } } });
  await prisma.homeSection.create({ data: { type: 'top_selling', title: 'Top Selling Electronics', subtitle: 'Fast-moving stock trusted by retailers across India', rank: 3, config: { limit: 12 } } });
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.homeSection.create({ data: { type: 'top_selling', title: `Top Selling ${c.name}`, rank: 4 + i, categoryId: cat[c.key].id, config: { limit: 12 } } });
  }

  console.log('done');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
