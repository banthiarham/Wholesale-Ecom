const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const buyer1 = '10089927-506a-4d08-b7ef-84310e76c586'; // Nikhil
const buyer2 = 'a3ce8d7a-af24-4675-b69a-65081209218d'; // Test

const products = [
  {
    title: 'Bluetooth Speaker Mini',
    handle: 'bluetooth-speaker-mini',
    description: 'Portable Bluetooth speaker with 12-hour battery life, IPX5 water resistance, and deep bass. Perfect for retail shops and corporate gifting at scale.',
    sku: 'BSM-101',
    moq: 50,
    unitPrice: 1200,
    compareAtPrice: 1500,
    inventoryQuantity: 2000,
    vendorName: 'AudioTech Corp',
    categoryId: '5125a882-be3b-4d33-9321-199cfa190064', // Electronics
    tags: ['electronics', 'audio', 'portable', 'bluetooth'],
    thumbnail: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1589003077984-894e133dabab?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 50, maxQty: 199, price: 1100 },
      { minQty: 200, maxQty: 499, price: 1000 },
      { minQty: 500, price: 900 },
    ],
    reviews: [
      { userId: buyer1, rating: 5, title: 'Outstanding bulk order experience', body: 'Ordered 300 units for our Diwali corporate gifting. Sound quality exceeded expectations and every unit was individually QC-passed. Shipping cartons were retail-ready.', helpful: 7 },
      { userId: buyer2, rating: 4, title: 'Great margins for resellers', body: 'We retail these at ₹2,499. The build quality is consistent across batches and customer return rate is under 1%. Only wish colour variants were available at same MOQ.', helpful: 4 },
    ],
  },
  {
    title: 'Hydraulic Jack 5 Ton',
    handle: 'hydraulic-jack-5-ton',
    description: 'Heavy-duty hydraulic floor jack with safety overload valve, swivel saddle, and rapid lift pump. Ideal for garages, workshops, and auto parts resellers.',
    sku: 'HJ5T-202',
    moq: 10,
    unitPrice: 8500,
    compareAtPrice: 11000,
    inventoryQuantity: 150,
    vendorName: 'ToolsMax Industries',
    categoryId: '5bd6f2bc-c8a3-4d8f-b0de-f2a05475c228', // Industrial
    tags: ['industrial', 'automotive', 'tools', 'hydraulic'],
    thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1621905251189-08b45d39c71c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 10, maxQty: 49, price: 7800 },
      { minQty: 50, price: 7000 },
    ],
    reviews: [
      { userId: buyer1, rating: 5, title: 'Garage-grade reliability', body: 'Supplied to 8 of our franchise workshops. Zero failure reports in 6 months. The overload valve gives our mechanics peace of mind under heavy SUVs.', helpful: 5 },
      { userId: buyer2, rating: 4, title: 'Solid steel, heavy shipping', body: 'Product quality is excellent but freight cost is high due to weight. Negotiated FOB terms for our second order which helped margins significantly.', helpful: 3 },
      { userId: buyer1, rating: 5, title: 'Quick delivery, well packed', body: 'Every unit arrived with individual foam wrapping and a calibration certificate. Vendor documentation is thorough.', helpful: 2 },
    ],
  },
  {
    title: 'Organic Cotton Bed Sheets Set',
    handle: 'organic-cotton-bed-sheets-set',
    description: 'GOTS-certified 100% organic cotton bedsheet sets in queen and king sizes. 400 thread count, pre-shrunk, naturally dyed. Ideal for boutique hotels and linen resellers.',
    sku: 'OCBS-303',
    moq: 30,
    unitPrice: 2200,
    compareAtPrice: 2800,
    inventoryQuantity: 800,
    vendorName: 'EcoTextile Mills',
    categoryId: 'b4629f5c-a2dd-4007-a4ba-f54f3679f0bb', // Fashion
    tags: ['fashion', 'home-textile', 'organic', 'hotel-supply'],
    thumbnail: 'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1616627547584-bf28cee262db?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 30, maxQty: 99, price: 2000 },
      { minQty: 100, maxQty: 299, price: 1800 },
      { minQty: 300, price: 1650 },
    ],
    reviews: [
      { userId: buyer2, rating: 5, title: 'Boutique hotel guests love them', body: 'We stock these in our 12-room heritage property. Guests consistently mention softness and the natural dye colours in reviews. Wash durability is excellent after 50+ cycles.', helpful: 6 },
      { userId: buyer1, rating: 4, title: 'Beautiful colours, slight shrinkage on first wash', body: 'The indigo and terracotta shades are stunning. We advise our retail customers to cold-wash first time. Beyond that, fabric holds shape perfectly.', helpful: 3 },
    ],
  },
  {
    title: 'Smart Security Camera 4K',
    handle: 'smart-security-camera-4k',
    description: '4K Wi-Fi security camera with night vision, two-way audio, motion detection, and cloud storage. POE and wireless dual-mode. Ideal for office buildings and retail chains.',
    sku: 'SSC4K-404',
    moq: 20,
    unitPrice: 4500,
    compareAtPrice: 6000,
    inventoryQuantity: 600,
    vendorName: 'SecureVision Tech',
    categoryId: '5125a882-be3b-4d33-9321-199cfa190064', // Electronics
    tags: ['electronics', 'security', 'camera', 'iot'],
    thumbnail: 'https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1589818288248-24a0a1309827?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 20, maxQty: 99, price: 4100 },
      { minQty: 100, price: 3600 },
    ],
    reviews: [
      { userId: buyer1, rating: 5, title: 'Installed across 4 office floors', body: 'Night vision clarity is genuinely 4K and the mobile app integration is seamless for our security team. Motion alerts are accurate with minimal false positives.', helpful: 8 },
      { userId: buyer2, rating: 4, title: 'Good POE support, cloud fees add up', body: 'Hardware is excellent and POE simplified our cabling. Be aware that cloud storage beyond 7 days is a recurring cost we now bundle into our client SLA pricing.', helpful: 4 },
    ],
  },
  {
    title: 'Stainless Steel Kitchen Utensil Set',
    handle: 'stainless-steel-kitchen-utensil-set',
    description: 'Premium 12-piece stainless steel kitchen utensil set with mirror polish finish. Dishwasher safe, rust-proof, ergonomic handles. Perfect for hotels, catering, and kitchenware resellers.',
    sku: 'SSKU-505',
    moq: 40,
    unitPrice: 950,
    compareAtPrice: 1200,
    inventoryQuantity: 1200,
    vendorName: 'ChefCraft Supplies',
    categoryId: 'b4629f5c-a2dd-4007-a4ba-f54f3679f0bb', // Fashion (home)
    tags: ['kitchenware', 'stainless-steel', 'hotel-supply', 'catering'],
    thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1584990347449-a1d9c9900a2d?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 40, maxQty: 149, price: 850 },
      { minQty: 150, price: 750 },
    ],
    reviews: [
      { userId: buyer2, rating: 5, title: 'Catering fleet standard issue', body: 'We equipped our 25-catering-van fleet with these sets. Handles stay cool, edges are smooth, and the mirror finish makes post-event cleaning faster for our crew.', helpful: 5 },
      { userId: buyer1, rating: 3, title: 'Good quality, packaging too tight', body: 'Product is solid but the shrink-wrap packaging left micro-scratches on 3% of pieces in our first lot. Vendor switched to foam inserts after we flagged it.', helpful: 2 },
    ],
  },
  {
    title: 'Portable Power Bank 20000mAh',
    handle: 'portable-power-bank-20000mah',
    description: 'High-capacity 20000mAh power bank with dual USB-C PD, Quick Charge 3.0, and LED display. Aviation-safe lithium polymer. Perfect for travel retail and corporate gifting.',
    sku: 'PPB20K-606',
    moq: 100,
    unitPrice: 850,
    compareAtPrice: 1100,
    inventoryQuantity: 3000,
    vendorName: 'ChargeMax Electronics',
    categoryId: '5125a882-be3b-4d33-9321-199cfa190064', // Electronics
    tags: ['electronics', 'power-bank', 'travel', 'corporate-gift'],
    thumbnail: 'https://images.unsplash.com/photo-1609592424323-c92b022d6920?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1609592424323-c92b022d6920?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1615526675159-e248c3021d3f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 100, maxQty: 499, price: 780 },
      { minQty: 500, price: 700 },
    ],
    reviews: [
      { userId: buyer1, rating: 5, title: 'Airline-safe, travel retail bestseller', body: 'We stock these at 8 airport kiosks. The UN38.3 certification is clearly printed on the box which security staff appreciate. Sales velocity is 3x our old 10000mAh model.', helpful: 9 },
      { userId: buyer2, rating: 4, title: 'Capacity tested at 19600mAh', body: 'Our QC lab tested 20 random units. Average real capacity was 19,600mAh which is honest for the category. Build quality is consistent. Good wholesale partner.', helpful: 5 },
      { userId: buyer1, rating: 5, title: 'Custom branding easy', body: 'Vendor provided UV-printed logo samples within 48 hours. Minimum for custom branding is only 200 units which is great for mid-size corporate orders.', helpful: 3 },
    ],
  },
  {
    title: 'N95 Face Mask Bulk Pack',
    handle: 'n95-face-mask-bulk-pack',
    description: 'NIOSH-approved N95 respirator masks, 5-layer filtration, adjustable nose clip, latex-free headbands. Box of 20 per inner pack. Essential for healthcare, construction, and safety resellers.',
    sku: 'N95BP-707',
    moq: 500,
    unitPrice: 45,
    compareAtPrice: 65,
    inventoryQuantity: 50000,
    vendorName: 'MediSafe Supplies',
    categoryId: '5bd6f2bc-c8a3-4d8f-b0de-f2a05475c228', // Industrial
    tags: ['safety', 'healthcare', 'ppe', 'n95', 'construction'],
    thumbnail: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 500, maxQty: 1999, price: 42 },
      { minQty: 2000, maxQty: 9999, price: 38 },
      { minQty: 10000, price: 35 },
    ],
    reviews: [
      { userId: buyer2, rating: 5, title: 'Hospital procurement approved', body: 'Our procurement team validated the NIOSH certificate directly with CDC database. Fit-test pass rate is 98% across our nursing staff. Reordering 10,000 units monthly now.', helpful: 11 },
      { userId: buyer1, rating: 4, title: 'Good seal, straps could be softer', body: 'Filtration is excellent per our in-house testing. Some users with smaller faces report strap pressure after 4+ hours. We provide silicone strap covers as a workaround.', helpful: 4 },
    ],
  },
  {
    title: 'Adjustable Standing Desk Frame',
    handle: 'adjustable-standing-desk-frame',
    description: 'Dual-motor electric standing desk frame with memory presets, anti-collision sensor, and cable management tray. Supports tabletops up to 180cm. Ideal for office fit-out contractors and furniture resellers.',
    sku: 'ASDF-808',
    moq: 15,
    unitPrice: 18000,
    compareAtPrice: 24000,
    inventoryQuantity: 120,
    vendorName: 'ErgoWork Furniture',
    categoryId: '5bd6f2bc-c8a3-4d8f-b0de-f2a05475c228', // Industrial
    tags: ['furniture', 'office', 'ergonomic', 'standing-desk'],
    thumbnail: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 15, maxQty: 49, price: 16500 },
      { minQty: 50, price: 15000 },
    ],
    reviews: [
      { userId: buyer1, rating: 5, title: 'Silent motors, happy open-plan office', body: 'Installed 40 units in our new satellite office. Motor noise is under 45dB which means no complaints from adjacent desks. Memory presets make hot-desking practical.', helpful: 6 },
      { userId: buyer2, rating: 4, title: 'Solid steel frame, assembly manual needs work', body: 'The frame itself is rock-solid at full height extension. Assembly took 25 minutes per unit but the pictorial guide was ambiguous about cable routing. Video link from vendor solved it.', helpful: 3 },
      { userId: buyer1, rating: 5, title: 'Anti-collision saved a monitor', body: 'The sensor genuinely works — detected a filing cabinet during descent and reversed automatically. Saved us a broken monitor and potential injury claim.', helpful: 7 },
    ],
  },
  {
    title: 'Biodegradable Food Container Pack',
    handle: 'biodegradable-food-container-pack',
    description: 'Sugarcane bagasse food containers with leak-proof PLA lining. Microwave and freezer safe. Stackable design. Perfect for cloud kitchens, takeaway chains, and eco-friendly packaging resellers.',
    sku: 'BFC-909',
    moq: 200,
    unitPrice: 18,
    compareAtPrice: 25,
    inventoryQuantity: 15000,
    vendorName: 'GreenPack Solutions',
    categoryId: 'b4629f5c-a2dd-4007-a4ba-f54f3679f0bb', // Fashion (packaging)
    tags: ['packaging', 'eco-friendly', 'food-container', 'biodegradable'],
    thumbnail: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1605600659908-0ef719419d42?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 200, maxQty: 999, price: 16 },
      { minQty: 1000, maxQty: 4999, price: 14 },
      { minQty: 5000, price: 12 },
    ],
    reviews: [
      { userId: buyer2, rating: 5, title: 'Cloud kitchen staple, no leaks', body: 'We serve curry and biryani in these daily. Zero leak complaints in 8 months and the stackable design cut our storage footprint by 30%. Customers love the eco angle.', helpful: 8 },
      { userId: buyer1, rating: 4, title: 'Microwave safe up to 3 minutes', body: 'Tested extensively. Safe for standard reheating. Longer than 3 minutes at high power can soften the corners slightly. We communicate this clearly to our franchisees.', helpful: 3 },
    ],
  },
  {
    title: 'Digital Multimeter Pro',
    handle: 'digital-multimeter-pro',
    description: 'True RMS digital multimeter with auto-ranging, 6000 counts, CAT III 600V safety rating, backlit LCD, and magnetic hanger. Ideal for electricians, service centres, and tool distributors.',
    sku: 'DMM-010',
    moq: 25,
    unitPrice: 2800,
    compareAtPrice: 3500,
    inventoryQuantity: 400,
    vendorName: 'ToolsMax Industries',
    categoryId: '5bd6f2bc-c8a3-4d8f-b0de-f2a05475c228', // Industrial
    tags: ['industrial', 'tools', 'electrical', 'multimeter'],
    thumbnail: 'https://images.unsplash.com/photo-1621905251189-08b45d39c71c?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1621905251189-08b45d39c71c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&h=600&fit=crop',
    ],
    tierPrices: [
      { minQty: 25, maxQty: 99, price: 2500 },
      { minQty: 100, price: 2200 },
    ],
    reviews: [
      { userId: buyer1, rating: 5, title: 'Service centre daily driver', body: 'Our 12 technicians use these daily. Auto-ranging saves time on every job and the magnetic hanger is surprisingly useful when working inside panels. Calibration certificate included.', helpful: 6 },
      { userId: buyer2, rating: 4, title: 'Accurate readings, screen glare in sunlight', body: 'Accuracy is within spec per our Fluke reference comparison. The backlight helps but direct sunlight can still wash out the display. We use the hold function and step into shade.', helpful: 2 },
    ],
  },
];

async function main() {
  for (const p of products) {
    const { tierPrices, reviews, ...productData } = p;

    const created = await prisma.product.create({
      data: {
        ...productData,
        status: 'PUBLISHED',
        rating: 0,
        reviewCount: 0,
        tierPrices: tierPrices ? { create: tierPrices } : undefined,
      },
    });

    if (reviews && reviews.length > 0) {
      let totalRating = 0;
      for (const r of reviews) {
        await prisma.review.create({
          data: { ...r, productId: created.id, isVerified: true },
        });
        totalRating += r.rating;
      }
      const avg = totalRating / reviews.length;
      await prisma.product.update({
        where: { id: created.id },
        data: { rating: avg, reviewCount: reviews.length },
      });
    }

    console.log(`Created ${p.title} with ${reviews?.length || 0} reviews.`);
  }
  console.log('Done seeding 10 products.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
