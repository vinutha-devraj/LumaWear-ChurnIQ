import { SlidersHorizontal, X } from "lucide-react";

function Checkbox({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-sand text-ink focus:ring-ink"
      />
      {children}
    </label>
  );
}

export default function FilterSidebar({
  mobileOpen,
  setMobileOpen,
  filters,
  setFilters,
  sort,
  setSort,
  categories,
  colors,
  sizes,
  showDesktopPanel = true,
  showMobileTrigger = true,
}) {
  const panel = (
    <div className="space-y-5 rounded-xl2 border border-sand bg-white p-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Category</h3>
        <div className="space-y-2">
          {categories.map((cat) => (
            <Checkbox
              key={cat}
              checked={filters.categories.includes(cat)}
              onChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  categories: prev.categories.includes(cat)
                    ? prev.categories.filter((x) => x !== cat)
                    : [...prev.categories, cat],
                }))
              }
            >
              {cat}
            </Checkbox>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Gender</h3>
        <div className="space-y-2">
          {["Women", "Men", "Unisex"].map((gender) => (
            <Checkbox
              key={gender}
              checked={filters.genders.includes(gender)}
              onChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  genders: prev.genders.includes(gender)
                    ? prev.genders.filter((x) => x !== gender)
                    : [...prev.genders, gender],
                }))
              }
            >
              {gender}
            </Checkbox>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Size</h3>
        <div className="grid grid-cols-3 gap-2">
          {sizes.slice(0, 9).map((size) => (
            <button
              key={size}
              className={`focus-ring rounded-lg border px-2 py-1 text-xs transition ${
                filters.sizes.includes(size)
                  ? "border-ink bg-ink text-cream"
                  : "border-sand bg-cream hover:bg-sand/40"
              }`}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  sizes: prev.sizes.includes(size)
                    ? prev.sizes.filter((x) => x !== size)
                    : [...prev.sizes, size],
                }))
              }
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Color</h3>
        <div className="flex flex-wrap gap-2">
          {colors.slice(0, 10).map((color) => (
            <button
              key={color}
              className={`focus-ring rounded-full border px-3 py-1 text-xs transition ${
                filters.colors.includes(color) ? "border-ink bg-ink text-cream" : "border-sand hover:bg-sand/40"
              }`}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  colors: prev.colors.includes(color)
                    ? prev.colors.filter((x) => x !== color)
                    : [...prev.colors, color],
                }))
              }
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Price range (max)</h3>
        <input
          type="range"
          min={40}
          max={220}
          value={filters.maxPrice}
          onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: Number(e.target.value) }))}
          className="w-full accent-ink"
        />
        <p className="text-xs text-charcoal/70">Up to ${filters.maxPrice}</p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => setFilters((prev) => ({ ...prev, inStockOnly: e.target.checked }))}
            className="h-4 w-4 rounded border-sand text-ink focus:ring-ink"
          />
          In stock only
        </label>
      </div>

      <div>
        <label className="text-sm font-semibold" htmlFor="sort-select">
          Sort by
        </label>
        <select
          id="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="focus-ring mt-2 w-full rounded-lg border border-sand bg-cream px-3 py-2 text-sm"
        >
          <option value="featured">Featured</option>
          <option value="priceLow">Price: Low to High</option>
          <option value="priceHigh">Price: High to Low</option>
          <option value="rating">Top Rated</option>
          <option value="new">Newest</option>
        </select>
      </div>
    </div>
  );

  return (
    <>
      {showDesktopPanel && <div className="hidden lg:block">{panel}</div>}
      {showMobileTrigger && (
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-sand bg-white px-4 py-2 text-sm lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <SlidersHorizontal size={16} /> Filters
        </button>
      )}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] bg-black/30 lg:hidden">
          <div className="ml-auto h-full w-[88%] max-w-sm overflow-y-auto bg-cream p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button className="focus-ring rounded-full p-2 hover:bg-sand/30" onClick={() => setMobileOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}
