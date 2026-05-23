const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const productImages = [
  {
    id: '4819428d-a247-4381-b080-23ed7835982f',
    title: 'Industrial Drill Machine',
    thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504328345606-18bbc8fce9d7?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&h=600&fit=crop',
    ],
  },
  {
    id: 'b61fb114-616b-4d2e-92c7-696127c78737',
    title: 'Smart LED Panel 24W',
    thumbnail: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&h=600&fit=crop',
    ],
  },
  {
    id: 'e023a755-373c-48f7-9a34-7212d7db8dd9',
    title: 'Wireless Earbuds Pro',
    thumbnail: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1572569028738-411a1973d274?w=800&h=600&fit=crop',
    ],
  },
  {
    id: 'fad7233e-15bb-4b96-919f-5d3a1fade78e',
    title: 'Cotton T-Shirt Bulk',
    thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=600&fit=crop',
    ],
  },
];

async function main() {
  for (const p of productImages) {
    await prisma.product.update({
      where: { id: p.id },
      data: {
        thumbnail: p.thumbnail,
        images: p.images,
      },
    });
    console.log(`Updated ${p.title} with working images.`);
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
