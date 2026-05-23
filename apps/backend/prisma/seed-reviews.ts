const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const reviews = [
  {
    productId: '4819428d-a247-4381-b080-23ed7835982f',
    userId: '10089927-506a-4d08-b7ef-84310e76c586',
    rating: 5,
    title: 'Heavy-duty performance for our factory',
    body: 'We ordered 12 units for our assembly line and the torque consistency is excellent. The warranty terms were clearly documented and delivery arrived 2 days early. Will reorder next quarter.',
    isVerified: true,
    helpful: 4,
  },
  {
    productId: '4819428d-a247-4381-b080-23ed7835982f',
    userId: 'a3ce8d7a-af24-4675-b69a-65081209218d',
    rating: 4,
    title: 'Great value, minor calibration needed',
    body: 'Solid build quality and the wholesale pricing saved us roughly 18% compared to our previous supplier. We had to recalibrate two units out of the batch but support resolved it within 24 hours.',
    isVerified: true,
    helpful: 2,
  },
  {
    productId: 'b61fb114-616b-4d2e-92c7-696127c78737',
    userId: '10089927-506a-4d08-b7ef-84310e76c586',
    rating: 5,
    title: 'Perfect for warehouse retrofit',
    body: 'We replaced all our old fluorescent fixtures with these LED panels across two warehouses. Power consumption dropped significantly and the light uniformity is much better. Bulk MOQ was reasonable.',
    isVerified: true,
    helpful: 6,
  },
  {
    productId: 'b61fb114-616b-4d2e-92c7-696127c78737',
    userId: 'a3ce8d7a-af24-4675-b69a-65081209218d',
    rating: 4,
    title: 'Good lumen output, packaging could improve',
    body: 'Product itself is top notch but two panels had minor edge scratches due to loose packaging in the bulk crate. The vendor sent replacements immediately so still a positive experience.',
    isVerified: true,
    helpful: 1,
  },
  {
    productId: 'e023a755-373c-48f7-9a34-7212d7db8dd9',
    userId: '10089927-506a-4d08-b7ef-84310e76c586',
    rating: 3,
    title: 'Decent for retail resale, battery life average',
    body: 'We stock these in our electronics outlet. Customers like the design but a few returned units citing 6-hour battery life instead of the advertised 8 hours. At wholesale cost the margin is still acceptable.',
    isVerified: true,
    helpful: 3,
  },
  {
    productId: 'e023a755-373c-48f7-9a34-7212d7db8dd9',
    userId: 'a3ce8d7a-af24-4675-b69a-65081209218d',
    rating: 4,
    title: 'Fast pairing, good OEM branding potential',
    body: 'We are adding our private label to these. The Bluetooth pairing speed is impressive and the charging case finish is premium. Only wish the MOQ was slightly lower for first-time trial orders.',
    isVerified: true,
    helpful: 2,
  },
  {
    productId: 'fad7233e-15bb-4b96-919f-5d3a1fade78e',
    userId: '10089927-506a-4d08-b7ef-84310e76c586',
    rating: 5,
    title: 'Consistent sizing across 500-piece order',
    body: 'Ordered 500 mixed sizes for our corporate event merchandise. Every unit matched the size chart exactly and the fabric weight is consistent. The vendor even provided custom poly-bagging at no extra charge.',
    isVerified: true,
    helpful: 5,
  },
  {
    productId: 'fad7233e-15bb-4b96-919f-5d3a1fade78e',
    userId: 'a3ce8d7a-af24-4675-b69a-65081209218d',
    rating: 4,
    title: 'Soft cotton, colours run slightly on first wash',
    body: 'Great price point for resale. Fabric is genuinely soft. We recommend advising end customers to wash dark colours separately for the first two cycles. Vendor transparency on this would help.',
    isVerified: true,
    helpful: 3,
  },
];

async function main() {
  for (const r of reviews) {
    await prisma.review.create({ data: r });
  }
  console.log(`Inserted ${reviews.length} reviews.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
