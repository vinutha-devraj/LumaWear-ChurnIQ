import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import FilterSidebar from "../components/FilterSidebar";
import ProductCard from "../components/ProductCard";
import SkeletonCard from "../components/SkeletonCard";
import { useStore } from "../context/StoreContext";

const INITIAL_VISIBLE = 8;

export default function ShopPage() {
  const { products } = useStore();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [sort, setSort] = useState("featured");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    categories: searchParams.get("category") ? [searchParams.get("category")] : [],
    genders: searchParams.get("gender") ? [searchParams.get("gender")] : [],
    sizes: [],
    colors: [],
    maxPrice: 220,
    inStockOnly: false,
    onSaleOnly: searchParams.get("onSale") === "true",
    collection: searchParams.get("collection") || "",
    newOnly: searchParams.get("tag") === "new",
  });

  useEffect(() => {
    setQuery(searchParams.get("search") || "");
    setFilters((prev) => ({
      ...prev,
      categories: searchParams.get("category") ? [searchParams.get("category")] : [],
      genders: searchParams.get("gender") ? [searchParams.get("gender")] : [],
      onSaleOnly: searchParams.get("onSale") === "true",
      collection: searchParams.get("collection") || "",
      newOnly: searchParams.get("tag") === "new",
    }));
  }, [searchParams]);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 450);
    return () => clearTimeout(timer);
  }, [query, filters, sort]);

  useEffect(() => setVisibleCount(INITIAL_VISIBLE), [query, filters, sort]);

  const categories = useMemo(() => [...new Set(products.map((item) => item.category))], [products]);
  const colors = useMemo(() => [...new Set(products.flatMap((item) => item.colors))], [products]);
  const sizes = useMemo(() => [...new Set(products.flatMap((item) => item.sizes))], [products]);

  const filtered = useMemo(() => {
    // Single filtering pipeline keeps search, facets, and sort behavior consistent.
    const search = query.trim().toLowerCase();
    const list = products.filter((item) => {
      const textMatch =
        search === "" ||
        item.name.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search) ||
        item.gender.toLowerCase().includes(search);
      const categoryMatch = filters.categories.length === 0 || filters.categories.includes(item.category);
      const genderMatch = filters.genders.length === 0 || filters.genders.includes(item.gender);
      const sizeMatch = filters.sizes.length === 0 || item.sizes.some((size) => filters.sizes.includes(size));
      const colorMatch = filters.colors.length === 0 || item.colors.some((color) => filters.colors.includes(color));
      const priceMatch = (item.salePrice || item.price) <= filters.maxPrice;
      const stockMatch = !filters.inStockOnly || item.inStock;
      const saleMatch = !filters.onSaleOnly || Boolean(item.salePrice);
      const collectionMatch = !filters.collection || item.collection === filters.collection;
      const newMatch = !filters.newOnly || item.newArrival;
      return (
        textMatch &&
        categoryMatch &&
        genderMatch &&
        sizeMatch &&
        colorMatch &&
        priceMatch &&
        stockMatch &&
        saleMatch &&
        collectionMatch &&
        newMatch
      );
    });

    if (sort === "priceLow") {
      list.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    } else if (sort === "priceHigh") {
      list.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    } else if (sort === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sort === "new") {
      list.sort((a, b) => Number(b.newArrival) - Number(a.newArrival));
    }

    return list;
  }, [filters, products, query, sort]);

  const visibleProducts = filtered.slice(0, visibleCount);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 md:px-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Shop</h1>
          <p className="text-sm text-charcoal/70">{filtered.length} results</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form className="relative">
            <label htmlFor="shop-search" className="sr-only">
              Search products
            </label>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/65" />
            <input
              id="shop-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              className="focus-ring w-64 rounded-full border border-sand bg-white py-2 pl-9 pr-4 text-sm"
            />
          </form>
          <FilterSidebar
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            filters={filters}
            setFilters={setFilters}
            sort={sort}
            setSort={setSort}
            categories={categories}
            colors={colors}
            sizes={sizes}
            showDesktopPanel={false}
            showMobileTrigger={true}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <FilterSidebar
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          setSort={setSort}
          categories={categories}
          colors={colors}
          sizes={sizes}
          showDesktopPanel={true}
          showMobileTrigger={false}
        />

        <div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="rounded-xl2 border border-sand bg-white p-8 text-center">
              <h2 className="text-xl font-semibold">No products found</h2>
              <p className="mt-2 text-sm text-charcoal/70">Try adjusting search terms or clearing filters.</p>
              <button
                className="focus-ring mt-4 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream"
                onClick={() => {
                  setQuery("");
                  setSort("featured");
                  setFilters({
                    categories: [],
                    genders: [],
                    sizes: [],
                    colors: [],
                    maxPrice: 220,
                    inStockOnly: false,
                    onSaleOnly: false,
                    collection: "",
                    newOnly: false,
                  });
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {visibleCount < filtered.length && (
                <div className="mt-8 text-center">
                  <button
                    className="focus-ring rounded-full border border-ink px-6 py-2 text-sm font-medium transition hover:bg-ink hover:text-cream"
                    onClick={() => setVisibleCount((prev) => prev + 8)}
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
