const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const replacements: Record<string, string> = {
  'https://images.unsplash.com/photo-1621905251189-08b45d39c71c': 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd',
  'https://images.unsplash.com/photo-1589818288248-24a0a1309827': 'https://images.unsplash.com/photo-1608231387042-66d1773070a5',
  'https://images.unsplash.com/photo-1556910103-1c02745a30bf': 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261',
  'https://images.unsplash.com/photo-1584990347449-a1d9c9900a2d': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136',
  'https://images.unsplash.com/photo-1609592424323-c92b022d6920': 'https://images.unsplash.com/photo-1593642532400-2682810df593',
  'https://images.unsplash.com/photo-1605600659908-0ef719419d42': 'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77',
};

async function main() {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, title: true, thumbnail: true, images: true },
  });

  let fixed = 0;
  for (const p of products) {
    let dirty = false;
    let newThumb = p.thumbnail;
    const newImages = p.images.map((img: string) => {
      for (const [bad, good] of Object.entries(replacements)) {
        if (img.startsWith(bad)) { dirty = true; return img.replace(bad, good); }
      }
      return img;
    });
    for (const [bad, good] of Object.entries(replacements)) {
      if (p.thumbnail && p.thumbnail.startsWith(bad)) { newThumb = p.thumbnail.replace(bad, good); dirty = true; }
    }

    if (dirty) {
      await prisma.product.update({ where: { id: p.id }, data: { thumbnail: newThumb, images: newImages } });
      console.log(`Fixed images for ${p.title}`);
      fixed++;
    }
  }
  console.log(`Done. Fixed ${fixed} products.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
