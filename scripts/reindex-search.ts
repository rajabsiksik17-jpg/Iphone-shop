/**
 * Rebuild the product search index (searchText / searchTitle / searchBrand /
 * searchPhonetic) and other derived fields for every product. Run after
 * changing the search normalization rules or bulk-importing products:
 *
 *   npm run search:reindex
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { refreshProductDerived } from "../src/server/catalog/derived";

async function main() {
  const products = await db.product.findMany({ select: { id: true } });
  let done = 0;
  for (const p of products) {
    await refreshProductDerived(p.id);
    if (++done % 50 === 0) console.log(`  · ${done}/${products.length}`);
  }
  console.log(`Reindexed ${done} products.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
