-- A product can be listed under several categories. "Product"."categoryId" stays as the
-- primary category; this join table holds the full set (primary included).
CREATE TABLE "_ProductCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_ProductCategories_AB_unique" ON "_ProductCategories"("A", "B");
CREATE INDEX "_ProductCategories_B_index" ON "_ProductCategories"("B");

ALTER TABLE "_ProductCategories" ADD CONSTRAINT "_ProductCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProductCategories" ADD CONSTRAINT "_ProductCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing products keep appearing in their current category.
INSERT INTO "_ProductCategories" ("A", "B")
SELECT "categoryId", "id" FROM "Product" WHERE "categoryId" IS NOT NULL;
