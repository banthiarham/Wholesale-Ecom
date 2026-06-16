-- ========================================
-- Seed: 5 Categories × 8 Products + Tier Prices + Category Images
-- ========================================

-- 1. Update existing categories with images
UPDATE "Category" SET image = 'https://images.unsplash.com/photo-1498049794561-1806a5ac2e69?w=600&h=400&fit=crop', description = 'Wholesale electronics — smartphones, audio, lighting, networking and more' WHERE handle = 'electronics';
UPDATE "Category" SET image = 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop', description = 'Wholesale fashion — apparel, footwear and accessories for bulk buyers' WHERE handle = 'fashion';
UPDATE "Category" SET image = 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=600&h=400&fit=crop', description = 'Industrial tools, machinery and safety equipment for businesses' WHERE handle = 'industrial';

-- 2. Insert 2 new categories
INSERT INTO "Category" (id, name, handle, description, image, "isActive", rank, "createdAt", "updatedAt")
VALUES
  ('cat-home-kitchen', 'Home & Kitchen', 'home-kitchen', 'Wholesale home & kitchen — appliances, cookware, storage and decor', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop', true, 3, NOW(), NOW()),
  ('cat-health-beauty', 'Health & Beauty', 'health-beauty', 'Wholesale health & beauty — skincare, wellness, hair care and grooming', 'https://images.unsplash.com/photo-1596462502278-27eadc37f862?w=600&h=400&fit=crop', true, 4, NOW(), NOW());

-- ========================================
-- 3. PRODUCTS — Electronics (7 new + 1 existing = 8)
-- ========================================
INSERT INTO "Product" (id, title, handle, description, sku, moq, "unitPrice", "compareAtPrice", status, "inventoryQuantity", images, thumbnail, "vendorName", tags, "categoryId", "createdAt", "updatedAt")
VALUES
  -- E1 – Smart LED Panel 24W (already exists)
  -- E2 – Wireless Earbuds Pro (already exists)
  -- E3
  ('prod-elec-03', 'Bluetooth Speaker 20W', 'bluetooth-speaker-20w',
   'Portable 20W Bluetooth speaker with deep bass and 12-hour battery life. IPX5 water resistant.',
   'BTS-020', 10, 1200.00, 1500.00, 'PUBLISHED', 250,
   ARRAY['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1589003077984-894e133dabab?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1558089687-f282ffcbc126?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop',
   'SoundWave Audio', ARRAY['electronics','speaker','bluetooth','portable'],
   '29b3aca8-3f2a-4490-8f11-ac5e30fa10de', NOW(), NOW()),

  -- E4
  ('prod-elec-04', 'USB-C Hub 7-in-1', 'usb-c-hub-7in1',
   '7-in-1 USB-C hub with HDMI 4K, 3×USB-A, SD/microSD, and 100W PD pass-through.',
   'UCH-007', 20, 750.00, 950.00, 'PUBLISHED', 400,
   ARRAY['https://images.unsplash.com/photo-1625842268584-8f3296236761?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1517336714731-489689fd82ca?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=400&h=400&fit=crop',
   'TechConnect India', ARRAY['electronics','usb-c','hub','accessories'],
   '29b3aca8-3f2a-4490-8f11-ac5e30fa10de', NOW(), NOW()),

  -- E5
  ('prod-elec-05', 'Security Camera WiFi 1080p', 'security-camera-wifi-1080p',
   '1080p HD WiFi security camera with night vision, motion detection and cloud storage.',
   'SEC-108', 5, 1800.00, 2200.00, 'PUBLISHED', 180,
   ARRAY['https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1574607383746-b581b0782858?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1558002038-9476-2b50b4e1a8fa?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=400&h=400&fit=crop',
   'SecureView Tech', ARRAY['electronics','security','camera','smart-home'],
   '29b3aca8-3f2a-4490-8f11-ac5e30fa10de', NOW(), NOW()),

  -- E6
  ('prod-elec-06', 'Power Bank 20000mAh', 'power-bank-20000mah',
   '20000mAh power bank with dual USB-A + USB-C fast charging. Slim metal body.',
   'PBK-200', 15, 950.00, 1200.00, 'PUBLISHED', 320,
   ARRAY['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1585338267585-4a3b82b9eb40?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1625772452859-1c03d5bf1137?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop',
   'ChargeMax', ARRAY['electronics','power-bank','charging','portable'],
   '29b3aca8-3f2a-4490-8f11-ac5e30fa10de', NOW(), NOW()),

  -- E7
  ('prod-elec-07', 'Smart Watch Pro X', 'smart-watch-pro-x',
   'Fitness-focused smartwatch with SpO2, heart rate, GPS, and 14-day battery.',
   'SWX-001', 10, 3500.00, 4200.00, 'PUBLISHED', 150,
   ARRAY['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1546868871-af0de0ae20be?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
   'FitTech Wearables', ARRAY['electronics','smartwatch','fitness','wearable'],
   '29b3aca8-3f2a-4490-8f11-ac5e30fa10de', NOW(), NOW()),

  -- E8
  ('prod-elec-08', 'Mechanical Keyboard RGB', 'mechanical-keyboard-rgb',
   'Full-size mechanical keyboard with hot-swappable switches, per-key RGB, and PBT keycaps.',
   'MKB-001', 10, 2800.00, 3400.00, 'PUBLISHED', 200,
   ARRAY['https://images.unsplash.com/photo-1618384887929-361a7e5d4c2c?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1595232453228-5a881707a96b?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1618384887929-361a7e5d4c2c?w=400&h=400&fit=crop',
   'KeyCraft India', ARRAY['electronics','keyboard','gaming','peripherals'],
   '29b3aca8-3f2a-4490-8f11-ac5e30fa10de', NOW(), NOW());

-- ========================================
-- Tier prices for new Electronics products
-- ========================================
INSERT INTO "TierPrice" (id, "productId", "minQty", "maxQty", price, "createdAt")
VALUES
  -- Bluetooth Speaker 20W
  ('tp-elec03-a', 'prod-elec-03', 10, 49, 1100.00, NOW()),
  ('tp-elec03-b', 'prod-elec-03', 50, NULL, 1000.00, NOW()),
  -- USB-C Hub 7-in-1
  ('tp-elec04-a', 'prod-elec-04', 20, 99, 680.00, NOW()),
  ('tp-elec04-b', 'prod-elec-04', 100, NULL, 600.00, NOW()),
  -- Security Camera
  ('tp-elec05-a', 'prod-elec-05', 5, 19, 1700.00, NOW()),
  ('tp-elec05-b', 'prod-elec-05', 20, NULL, 1550.00, NOW()),
  -- Power Bank
  ('tp-elec06-a', 'prod-elec-06', 15, 49, 850.00, NOW()),
  ('tp-elec06-b', 'prod-elec-06', 50, NULL, 780.00, NOW()),
  -- Smart Watch
  ('tp-elec07-a', 'prod-elec-07', 10, 49, 3200.00, NOW()),
  ('tp-elec07-b', 'prod-elec-07', 50, NULL, 2900.00, NOW()),
  -- Mechanical Keyboard
  ('tp-elec08-a', 'prod-elec-08', 10, 49, 2600.00, NOW()),
  ('tp-elec08-b', 'prod-elec-08', 50, NULL, 2300.00, NOW());

-- ========================================
-- 4. PRODUCTS — Fashion (7 new)
-- ========================================
INSERT INTO "Product" (id, title, handle, description, sku, moq, "unitPrice", "compareAtPrice", status, "inventoryQuantity", images, thumbnail, "vendorName", tags, "categoryId", "createdAt", "updatedAt")
VALUES
  -- F2 – (Cotton T-Shirt already exists)
  -- F2
  ('prod-fash-02', 'Denim Jeans Bulk Pack', 'denim-jeans-bulk-pack',
   'Classic straight-fit denim jeans. Durable 100% cotton denim, sizes 28-42. Bulk pricing available.',
   'DNJ-001', 50, 850.00, 1100.00, 'PUBLISHED', 500,
   ARRAY['https://images.unsplash.com/photo-1542272604-787c38355df5?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1475178626620-a4c07d3a2e2e?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1582552937354-3208171c0661?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1542272604-787c38355df5?w=400&h=400&fit=crop',
   'DenimCraft', ARRAY['fashion','jeans','denim','apparel'],
   '41a623a0-a9e9-48e5-922c-a889888a30cf', NOW(), NOW()),

  -- F3
  ('prod-fash-03', 'Running Shoes Sport Pack', 'running-shoes-sport-pack',
   'Lightweight mesh running shoes with EVA sole. Breathable, sizes 6-12. Ideal for gyms & retailers.',
   'RSH-001', 20, 1400.00, 1800.00, 'PUBLISHED', 350,
   ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
   'StrideFlex', ARRAY['fashion','shoes','running','sportswear'],
   '41a623a0-a9e9-48e5-922c-a889888a30cf', NOW(), NOW()),

  -- F4
  ('prod-fash-04', 'Polo Shirt Premium Cotton', 'polo-shirt-premium-cotton',
   'Premium cotton piqué polo shirt. Available in 8 colours, sizes S-XXL. Great for corporate orders.',
   'PLS-001', 30, 550.00, 750.00, 'PUBLISHED', 600,
   ARRAY['https://images.unsplash.com/photo-1625910513413-5fc421e0a0f8?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1625910513413-5fc421e0a0f8?w=400&h=400&fit=crop',
   'ClassicThreads', ARRAY['fashion','polo','shirt','corporate'],
   '41a623a0-a9e9-48e5-922c-a889888a30cf', NOW(), NOW()),

  -- F5
  ('prod-fash-05', 'Leather Wallet Bi-fold', 'leather-wallet-bifold',
   'Genuine leather bi-fold wallet with RFID blocking. 6 card slots, 2 note compartments.',
   'LWF-001', 25, 400.00, 550.00, 'PUBLISHED', 450,
   ARRAY['https://images.unsplash.com/photo-1627123424557-83275405e870?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1606503153255-59d8b8b82176?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1556742049-0cfed45153c1?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1627123424557-83275405e870?w=400&h=400&fit=crop',
   'LeatherCraft India', ARRAY['fashion','wallet','leather','accessories'],
   '41a623a0-a9e9-48e5-922c-a889888a30cf', NOW(), NOW()),

  -- F6
  ('prod-fash-06', 'Sunglasses UV400 Pack', 'sunglasses-uv400-pack',
   'UV400 polarized sunglasses in 6 trendy frame styles. Lightweight acetate frames.',
   'SGL-001', 30, 300.00, 450.00, 'PUBLISHED', 800,
   ARRAY['https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1511499767150-a48a23718a3a?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1577803645773-f3dea2e12106?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop',
   'ShadeVision', ARRAY['fashion','sunglasses','uv400','accessories'],
   '41a623a0-a9e9-48e5-922c-a889888a30cf', NOW(), NOW()),

  -- F7
  ('prod-fash-07', 'Hoodie Fleece Pullover', 'hoodie-fleece-pullover',
   'Warm fleece hoodie with kangaroo pocket. Brushed inner, sizes M-3XL. Perfect for winter stock.',
   'HDF-001', 30, 700.00, 900.00, 'PUBLISHED', 400,
   ARRAY['https://images.unsplash.com/photo-1556821840-3a63f9560937?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1620799140408-edc6dcb6d6ac?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1556821840-3a63f9560937?w=400&h=400&fit=crop',
   'UrbanWear Co.', ARRAY['fashion','hoodie','fleece','winter'],
   '41a623a0-a9e9-48e5-922c-a889888a30cf', NOW(), NOW()),

  -- F8
  ('prod-fash-08', 'Canvas Backpack 35L', 'canvas-backpack-35l',
   '35L durable canvas backpack with laptop sleeve, rain cover and multiple compartments.',
   'CBP-001', 15, 950.00, 1300.00, 'PUBLISHED', 280,
   ARRAY['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1622560480654-d96214fdc887?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
   'PackMate Gear', ARRAY['fashion','backpack','canvas','travel'],
   '41a623a0-a9e9-48e5-922c-a889888a30cf', NOW(), NOW());

-- Tier prices for new Fashion products
INSERT INTO "TierPrice" (id, "productId", "minQty", "maxQty", price, "createdAt")
VALUES
  ('tp-fash02-a', 'prod-fash-02', 50, 199, 750.00, NOW()),
  ('tp-fash02-b', 'prod-fash-02', 200, NULL, 650.00, NOW()),
  ('tp-fash03-a', 'prod-fash-03', 20, 49, 1300.00, NOW()),
  ('tp-fash03-b', 'prod-fash-03', 50, NULL, 1150.00, NOW()),
  ('tp-fash04-a', 'prod-fash-04', 30, 99, 480.00, NOW()),
  ('tp-fash04-b', 'prod-fash-04', 100, NULL, 420.00, NOW()),
  ('tp-fash05-a', 'prod-fash-05', 25, 99, 350.00, NOW()),
  ('tp-fash05-b', 'prod-fash-05', 100, NULL, 300.00, NOW()),
  ('tp-fash06-a', 'prod-fash-06', 30, 99, 260.00, NOW()),
  ('tp-fash06-b', 'prod-fash-06', 100, NULL, 220.00, NOW()),
  ('tp-fash07-a', 'prod-fash-07', 30, 99, 620.00, NOW()),
  ('tp-fash07-b', 'prod-fash-07', 100, NULL, 550.00, NOW()),
  ('tp-fash08-a', 'prod-fash-08', 15, 49, 880.00, NOW()),
  ('tp-fash08-b', 'prod-fash-08', 50, NULL, 780.00, NOW());

-- ========================================
-- 5. PRODUCTS — Industrial (7 new)
-- ========================================
INSERT INTO "Product" (id, title, handle, description, sku, moq, "unitPrice", "compareAtPrice", status, "inventoryQuantity", images, thumbnail, "vendorName", tags, "categoryId", "createdAt", "updatedAt")
VALUES
  -- I1 – Industrial Drill Machine already exists
  -- I2
  ('prod-indu-02', 'Angle Grinder 100mm', 'angle-grinder-100mm',
   'Powerful 750W angle grinder with 100mm disc. 12000 RPM, lock-on switch, 2 extra discs included.',
   'AGG-100', 5, 2200.00, 2700.00, 'PUBLISHED', 120,
   ARRAY['https://images.unsplash.com/photo-1504148455328-cf391e4d1a5d?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1572981779307-3d43268289e3?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1530124566582-a45a7e3e29e3?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1504148455328-cf391e4d1a5d?w=400&h=400&fit=crop',
   'PowerTool India', ARRAY['industrial','grinder','power-tool','construction'],
   'bfc21344-b13e-405f-99df-d766d3f78e35', NOW(), NOW()),

  -- I3
  ('prod-indu-03', 'Safety Helmet HDPE', 'safety-helmet-hdpe',
   'HDPE safety helmet with adjustable harness and sweatband. ISI marked, available in 5 colours.',
   'SHL-001', 50, 180.00, 250.00, 'PUBLISHED', 1000,
   ARRAY['https://images.unsplash.com/photo-1579962340917-10c3467ab4a0?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1590674899482-d191a84b0a0b?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1504307651254-356d2d054459?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1579962340917-10c3467ab4a0?w=400&h=400&fit=crop',
   'SafeGuard PPE', ARRAY['industrial','safety','helmet','ppe'],
   'bfc21344-b13e-405f-99df-d766d3f78e35', NOW(), NOW()),

  -- I4
  ('prod-indu-04', 'Welding Machine Inverter 200A', 'welding-machine-inverter-200a',
   'Portable 200A inverter welding machine. IGBT technology, ARC/MMA, LCD display.',
   'WMI-200', 3, 8500.00, 10000.00, 'PUBLISHED', 60,
   ARRAY['https://images.unsplash.com/photo-1605294537368-321e5b4ead9f?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1513828583688-c52646b50d2a?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1504530578650-9df4dbe8a0e0?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1605294537368-321e5b4ead9f?w=400&h=400&fit=crop',
   'WeldPro Tools', ARRAY['industrial','welding','inverter','machinery'],
   'bfc21344-b13e-405f-99df-d766d3f78e35', NOW(), NOW()),

  -- I5
  ('prod-indu-05', 'Digital Multimeter Pro', 'digital-multimeter-pro',
   'Auto-ranging digital multimeter with 6000 counts, NCV, temperature probe, and data hold.',
   'DMM-001', 10, 650.00, 850.00, 'PUBLISHED', 300,
   ARRAY['https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1581092921461-eab60e5f7acb?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=400&fit=crop',
   'MeasureTech', ARRAY['industrial','multimeter','testing','electrical'],
   'bfc21344-b13e-405f-99df-d766d3f78e35', NOW(), NOW()),

  -- I6
  ('prod-indu-06', 'Pipe Wrench Set 3-Piece', 'pipe-wrench-set-3piece',
   'Chrome-vanadium pipe wrench set — 10", 14", 18". Drop-forged, non-slip grip.',
   'PWRS-003', 10, 1200.00, 1600.00, 'PUBLISHED', 220,
   ARRAY['https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1530124566582-a45a7e3e29e3?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1504148455328-cf391e4d1a5d?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400&h=400&fit=crop',
   'GripMaster Tools', ARRAY['industrial','wrench','tools','plumbing'],
   'bfc21344-b13e-405f-99df-d766d3f78e35', NOW(), NOW()),

  -- I7
  ('prod-indu-07', 'Fire Extinguisher ABC 5kg', 'fire-extinguisher-abc-5kg',
   'ABC dry powder fire extinguisher 5kg. ISI certified, wall-mount bracket included.',
   'FEX-005', 5, 950.00, 1200.00, 'PUBLISHED', 400,
   ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1600585152220-80a0a5c40582?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop',
   'FireSafe India', ARRAY['industrial','safety','fire-extinguisher','emergency'],
   'bfc21344-b13e-405f-99df-d766d3f78e35', NOW(), NOW()),

  -- I8
  ('prod-indu-08', 'Cordless Impact Drill 20V', 'cordless-impact-drill-20v',
   '20V brushless cordless impact drill/driver. 2-speed gearbox, 2×4.0Ah batteries, LED light.',
   'CID-020', 5, 4500.00, 5500.00, 'PUBLISHED', 90,
   ARRAY['https://images.unsplash.com/photo-1504328347081-2a6f6c894568?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1581092914488-8f22e4e4a0f1?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1572981779307-3d43268289e3?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1504328347081-2a6f6c894568?w=400&h=400&fit=crop',
   'DrillForce Pro', ARRAY['industrial','drill','cordless','power-tool'],
   'bfc21344-b13e-405f-99df-d766d3f78e35', NOW(), NOW());

-- Tier prices for new Industrial products
INSERT INTO "TierPrice" (id, "productId", "minQty", "maxQty", price, "createdAt")
VALUES
  ('tp-indu02-a', 'prod-indu-02', 5, 19, 2050.00, NOW()),
  ('tp-indu02-b', 'prod-indu-02', 20, NULL, 1900.00, NOW()),
  ('tp-indu03-a', 'prod-indu-03', 50, 199, 155.00, NOW()),
  ('tp-indu03-b', 'prod-indu-03', 200, NULL, 130.00, NOW()),
  ('tp-indu04-a', 'prod-indu-04', 3, 9, 8000.00, NOW()),
  ('tp-indu04-b', 'prod-indu-04', 10, NULL, 7200.00, NOW()),
  ('tp-indu05-a', 'prod-indu-05', 10, 49, 580.00, NOW()),
  ('tp-indu05-b', 'prod-indu-05', 50, NULL, 500.00, NOW()),
  ('tp-indu06-a', 'prod-indu-06', 10, 49, 1050.00, NOW()),
  ('tp-indu06-b', 'prod-indu-06', 50, NULL, 900.00, NOW()),
  ('tp-indu07-a', 'prod-indu-07', 5, 19, 880.00, NOW()),
  ('tp-indu07-b', 'prod-indu-07', 20, NULL, 780.00, NOW()),
  ('tp-indu08-a', 'prod-indu-08', 5, 19, 4200.00, NOW()),
  ('tp-indu08-b', 'prod-indu-08', 20, NULL, 3800.00, NOW());

-- ========================================
-- 6. PRODUCTS — Home & Kitchen (8 new)
-- ========================================
INSERT INTO "Product" (id, title, handle, description, sku, moq, "unitPrice", "compareAtPrice", status, "inventoryQuantity", images, thumbnail, "vendorName", tags, "categoryId", "createdAt", "updatedAt")
VALUES
  ('prod-hk-01', 'Stainless Steel Pressure Cooker 5L', 'stainless-steel-pressure-cooker-5l',
   '5L stainless steel pressure cooker with safety valve and ISI mark. Induction compatible.',
   'PCK-005', 10, 1200.00, 1500.00, 'PUBLISHED', 350,
   ARRAY['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1585515320310-9e3b65b5b507?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1584568694244-14fbdfb71a0e?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
   'KitchenKing', ARRAY['home-kitchen','cooker','stainless-steel','cookware'],
   'cat-home-kitchen', NOW(), NOW()),

  ('prod-hk-02', 'Non-Stick Cookware Set 5-Piece', 'nonstick-cookware-set-5pc',
   '5-piece non-stick cookware set — 2 frying pans, 1 kadhai, 1 saucepan, 1 tawa. PFOA-free coating.',
   'NCS-005', 8, 2200.00, 2800.00, 'PUBLISHED', 250,
   ARRAY['https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1584270144950-571596ab7137?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1590794056226-9efc406e1cd8?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=400&h=400&fit=crop',
   'CookRight India', ARRAY['home-kitchen','cookware','non-stick','kitchen-set'],
   'cat-home-kitchen', NOW(), NOW()),

  ('prod-hk-03', 'Mixer Grinder 750W 3-Jar', 'mixer-grinder-750w-3jar',
   '750W mixer grinder with 3 stainless steel jars. 3-speed control, overload protection.',
   'MXG-750', 10, 2800.00, 3500.00, 'PUBLISHED', 300,
   ARRAY['https://images.unsplash.com/photo-1570222094114-d054a8368713?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1585515320310-9e3b65b5b507?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1570222094114-d054a8368713?w=400&h=400&fit=crop',
   'BlendMaster', ARRAY['home-kitchen','mixer','grinder','appliance'],
   'cat-home-kitchen', NOW(), NOW()),

  ('prod-hk-04', 'Borosilicate Glass Storage Set 6-Piece', 'borosilicate-glass-storage-set-6pc',
   '6-piece borosilicate glass food storage with airtight lids. Microwave & oven safe.',
   'BGS-006', 15, 850.00, 1100.00, 'PUBLISHED', 400,
   ARRAY['https://images.unsplash.com/photo-1584568694244-14fbdfb71a0e?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1607344645867-9256863840e5?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1584568694244-14fbdfb71a0e?w=400&h=400&fit=crop',
   'GlassStore Pro', ARRAY['home-kitchen','storage','glass','containers'],
   'cat-home-kitchen', NOW(), NOW()),

  ('prod-hk-05', 'LED Ceiling Light 24W Round', 'led-ceiling-light-24w-round',
   '24W round LED ceiling light. Warm white 3000K, 2400 lumens, flicker-free driver.',
   'LCL-024', 20, 450.00, 600.00, 'PUBLISHED', 600,
   ARRAY['https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&h=400&fit=crop',
   'BrightLight Solutions', ARRAY['home-kitchen','lighting','led','ceiling-light'],
   'cat-home-kitchen', NOW(), NOW()),

  ('prod-hk-06', 'Electric Kettle 1.8L Stainless', 'electric-kettle-1.8l-stainless',
   '1.8L stainless steel electric kettle with auto shut-off, boil-dry protection and 360° swivel base.',
   'EKL-018', 10, 950.00, 1200.00, 'PUBLISHED', 350,
   ARRAY['https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1570222094114-d054a8368713?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1585515320310-9e3b65b5b507?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=400&h=400&fit=crop',
   'BrewPerfect', ARRAY['home-kitchen','kettle','appliance','stainless-steel'],
   'cat-home-kitchen', NOW(), NOW()),

  ('prod-hk-07', 'Chopping Board Set Bamboo 3-Pack', 'chopping-board-set-bamboo-3pk',
   '3-piece bamboo chopping board set (small, medium, large). Antibacterial, knife-friendly surface.',
   'CBB-003', 20, 400.00, 550.00, 'PUBLISHED', 500,
   ARRAY['https://images.unsplash.com/photo-1590794056226-9efc406e1cd8?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1584568694244-14fbdfb71a0e?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1590794056226-9efc406e1cd8?w=400&h=400&fit=crop',
   'EcoKitchen', ARRAY['home-kitchen','cutting-board','bamboo','kitchen-tools'],
   'cat-home-kitchen', NOW(), NOW()),

  ('prod-hk-08', 'Wall Clock Wooden 12-Inch', 'wall-clock-wooden-12inch',
   '12-inch rustic wooden wall clock with silent quartz movement. Battery operated, no ticking.',
   'WCL-012', 15, 600.00, 800.00, 'PUBLISHED', 280,
   ARRAY['https://images.unsplash.com/photo-1563862233857-b594d6cbf0ca?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1504148455328-cf391e4d1a5d?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1563862233857-b594d6cbf0ca?w=400&h=400&fit=crop',
   'TimeCraft Décor', ARRAY['home-kitchen','clock','wooden','decor'],
   'cat-home-kitchen', NOW(), NOW());

-- Tier prices for Home & Kitchen
INSERT INTO "TierPrice" (id, "productId", "minQty", "maxQty", price, "createdAt")
VALUES
  ('tp-hk01-a', 'prod-hk-01', 10, 49, 1100.00, NOW()),
  ('tp-hk01-b', 'prod-hk-01', 50, NULL, 980.00, NOW()),
  ('tp-hk02-a', 'prod-hk-02', 8, 29, 2000.00, NOW()),
  ('tp-hk02-b', 'prod-hk-02', 30, NULL, 1800.00, NOW()),
  ('tp-hk03-a', 'prod-hk-03', 10, 49, 2600.00, NOW()),
  ('tp-hk03-b', 'prod-hk-03', 50, NULL, 2300.00, NOW()),
  ('tp-hk04-a', 'prod-hk-04', 15, 49, 750.00, NOW()),
  ('tp-hk04-b', 'prod-hk-04', 50, NULL, 650.00, NOW()),
  ('tp-hk05-a', 'prod-hk-05', 20, 99, 400.00, NOW()),
  ('tp-hk05-b', 'prod-hk-05', 100, NULL, 350.00, NOW()),
  ('tp-hk06-a', 'prod-hk-06', 10, 49, 870.00, NOW()),
  ('tp-hk06-b', 'prod-hk-06', 50, NULL, 780.00, NOW()),
  ('tp-hk07-a', 'prod-hk-07', 20, 99, 350.00, NOW()),
  ('tp-hk07-b', 'prod-hk-07', 100, NULL, 300.00, NOW()),
  ('tp-hk08-a', 'prod-hk-08', 15, 49, 530.00, NOW()),
  ('tp-hk08-b', 'prod-hk-08', 50, NULL, 470.00, NOW());

-- ========================================
-- 7. PRODUCTS — Health & Beauty (8 new)
-- ========================================
INSERT INTO "Product" (id, title, handle, description, sku, moq, "unitPrice", "compareAtPrice", status, "inventoryQuantity", images, thumbnail, "vendorName", tags, "categoryId", "createdAt", "updatedAt")
VALUES
  ('prod-hb-01', 'Vitamin C Serum 30ml', 'vitamin-c-serum-30ml',
   '20% Vitamin C serum with hyaluronic acid & vitamin E. Brightens, firms and reduces dark spots.',
   'VCS-030', 20, 350.00, 500.00, 'PUBLISHED', 600,
   ARRAY['https://images.unsplash.com/photo-1596462502278-27eadc37f862?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1571781926291-c477ebfd9858?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1556228578-0d85b1a4d591?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1596462502278-27eadc37f862?w=400&h=400&fit=crop',
   'GlowCare Labs', ARRAY['health-beauty','serum','vitamin-c','skincare'],
   'cat-health-beauty', NOW(), NOW()),

  ('prod-hb-02', 'Argan Oil Shampoo 500ml', 'argan-oil-shampoo-500ml',
   'Sulfate-free argan oil shampoo for smooth, frizz-free hair. Paraben-free, pH balanced.',
   'AOS-500', 20, 280.00, 380.00, 'PUBLISHED', 700,
   ARRAY['https://images.unsplash.com/photo-1535585209827-a15fcdbc4ec2?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1571781926291-c477ebfd9858?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1535585209827-a15fcdbc4ec2?w=400&h=400&fit=crop',
   'HairNaturals', ARRAY['health-beauty','shampoo','argan','hair-care'],
   'cat-health-beauty', NOW(), NOW()),

  ('prod-hb-03', 'Aloe Vera Gel 200ml', 'aloe-vera-gel-200ml',
   'Pure aloe vera gel for skin and hair. Multipurpose — moisturiser, after-sun, hair styling.',
   'AVG-200', 25, 180.00, 250.00, 'PUBLISHED', 900,
   ARRAY['https://images.unsplash.com/photo-1556228578-0d85b1a4d591?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1596462502278-27eadc37f862?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1571781926291-c477ebfd9858?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1556228578-0d85b1a4d591?w=400&h=400&fit=crop',
   'PureLeaf Naturals', ARRAY['health-beauty','aloe-vera','gel','skincare'],
   'cat-health-beauty', NOW(), NOW()),

  ('prod-hb-04', 'Sunscreen SPF 50 Lotion 100ml', 'sunscreen-spf50-lotion-100ml',
   'Broad spectrum SPF 50 sunscreen lotion. Water-resistant, non-greasy, PA++++ protection.',
   'SSL-100', 20, 320.00, 450.00, 'PUBLISHED', 550,
   ARRAY['https://images.unsplash.com/photo-1571781926291-c477ebfd9858?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1556228578-0d85b1a4d591?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1596462502278-27eadc37f862?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1571781926291-c477ebfd9858?w=400&h=400&fit=crop',
   'SunShield Derm', ARRAY['health-beauty','sunscreen','spf50','skincare'],
   'cat-health-beauty', NOW(), NOW()),

  ('prod-hb-05', 'Herbal Face Wash Neem 150ml', 'herbal-face-wash-neem-150ml',
   'Neem & tulsi herbal face wash. Anti-acne, deep cleansing, suitable for all skin types.',
   'HFW-150', 25, 150.00, 220.00, 'PUBLISHED', 800,
   ARRAY['https://images.unsplash.com/photo-1556228578-0d85b1a4d591?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1535585209827-a15fcdbc4ec2?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1596462502278-27eadc37f862?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1556228578-0d85b1a4d591?w=400&h=400&fit=crop',
   'AyurGlow', ARRAY['health-beauty','face-wash','neem','herbal'],
   'cat-health-beauty', NOW(), NOW()),

  ('prod-hb-06', 'Protein Powder Whey 1kg', 'protein-powder-whey-1kg',
   'Whey protein concentrate 1kg — 24g protein per serving. Chocolate flavour, lab-tested.',
   'WPW-001', 10, 1100.00, 1400.00, 'PUBLISHED', 400,
   ARRAY['https://images.unsplash.com/photo-1593095948071-474a5a0e8558?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1579722841273-96467b5e6846?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1571781926291-c477ebfd9858?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1593095948071-474a5a0e8558?w=400&h=400&fit=crop',
   'FitNutrition', ARRAY['health-beauty','protein','whey','fitness'],
   'cat-health-beauty', NOW(), NOW()),

  ('prod-hb-07', 'Electric Toothbrush Sonic', 'electric-toothbrush-sonic',
   'Sonic electric toothbrush with 5 cleaning modes, 2-minute smart timer, and 4 brush heads.',
   'ETB-001', 15, 750.00, 1000.00, 'PUBLISHED', 350,
   ARRAY['https://images.unsplash.com/photo-1559591937-86c6b3d286ad?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1609810175960-61c727a54e18?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1571781926291-c477ebfd9858?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1559591937-86c6b3d286ad?w=400&h=400&fit=crop',
   'DentaCare Pro', ARRAY['health-beauty','toothbrush','electric','oral-care'],
   'cat-health-beauty', NOW(), NOW()),

  ('prod-hb-08', 'Essential Oil Set 6-Pack', 'essential-oil-set-6pk',
   '6-pack essential oils — lavender, tea tree, eucalyptus, peppermint, lemon, orange. 100% pure.',
   'EOS-006', 15, 500.00, 700.00, 'PUBLISHED', 450,
   ARRAY['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1556228578-0d85b1a4d591?w=800&h=800&fit=crop','https://images.unsplash.com/photo-1596462502278-27eadc37f862?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop',
   'AromaPure', ARRAY['health-beauty','essential-oils','aromatherapy','wellness'],
   'cat-health-beauty', NOW(), NOW());

-- Tier prices for Health & Beauty
INSERT INTO "TierPrice" (id, "productId", "minQty", "maxQty", price, "createdAt")
VALUES
  ('tp-hb01-a', 'prod-hb-01', 20, 99, 310.00, NOW()),
  ('tp-hb01-b', 'prod-hb-01', 100, NULL, 270.00, NOW()),
  ('tp-hb02-a', 'prod-hb-02', 20, 99, 250.00, NOW()),
  ('tp-hb02-b', 'prod-hb-02', 100, NULL, 210.00, NOW()),
  ('tp-hb03-a', 'prod-hb-03', 25, 99, 150.00, NOW()),
  ('tp-hb03-b', 'prod-hb-03', 100, NULL, 120.00, NOW()),
  ('tp-hb04-a', 'prod-hb-04', 20, 99, 280.00, NOW()),
  ('tp-hb04-b', 'prod-hb-04', 100, NULL, 240.00, NOW()),
  ('tp-hb05-a', 'prod-hb-05', 25, 99, 130.00, NOW()),
  ('tp-hb05-b', 'prod-hb-05', 100, NULL, 105.00, NOW()),
  ('tp-hb06-a', 'prod-hb-06', 10, 49, 1000.00, NOW()),
  ('tp-hb06-b', 'prod-hb-06', 50, NULL, 880.00, NOW()),
  ('tp-hb07-a', 'prod-hb-07', 15, 49, 680.00, NOW()),
  ('tp-hb07-b', 'prod-hb-07', 50, NULL, 600.00, NOW()),
  ('tp-hb08-a', 'prod-hb-08', 15, 49, 440.00, NOW()),
  ('tp-hb08-b', 'prod-hb-08', 50, NULL, 380.00, NOW());