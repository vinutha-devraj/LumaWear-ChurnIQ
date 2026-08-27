import { Link } from "react-router-dom";
import { categories } from "../data/products";
import { useStore } from "../context/StoreContext";
import ProductCard from "../components/ProductCard";

const lookbookImages = [
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
];

const testimonials = [
  {
    quote: "The fit and fabric quality are exceptional. Every piece feels premium and timeless.",
    name: "Naomi R.",
  },
  {
    quote: "LumaWear nails clean design and comfort. I wear these staples every week.",
    name: "Jordan P.",
  },
  {
    quote: "Fast delivery, easy returns, and truly beautiful essentials.",
    name: "Camille T.",
  },
];

export default function HomePage() {
  const { products } = useStore();
  const featured = products.slice(0, 8);
  const bestSellers = products.filter((item) => item.bestSeller).slice(0, 4);

  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 pt-6 md:px-6">
        <div className="relative overflow-hidden rounded-[1.75rem]">
          <img
            src="https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=1800&q=80"
            alt="Modern fashion editorial look"
            className="h-[72svh] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 max-w-xl p-6 text-cream md:p-10">
            <p className="text-xs uppercase tracking-[0.2em] text-cream/85">LumaWear Summer 2026</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-6xl">Style That Moves With You</h1>
            <p className="mt-4 text-sm text-cream/90 md:text-base">
              Curated layers and modern silhouettes designed for effortless, elevated everyday dressing.
            </p>
            <Link
              to="/new-arrivals"
              className="focus-ring mt-6 inline-block rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink transition hover:bg-white"
            >
              Shop New Arrivals
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-7xl px-4 md:px-6">
        <h2 className="mb-4 text-2xl font-semibold">Shop by category</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category}
              to={category === "Sale" ? "/shop?onSale=true" : `/shop?search=${encodeURIComponent(category)}`}
              className="focus-ring group relative overflow-hidden rounded-xl2 border border-sand bg-white"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent opacity-70 transition group-hover:opacity-85" />
              <img
                src={`https://source.unsplash.com/800x1000/?${category},fashion`}
                alt={`${category} fashion`}
                className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute bottom-3 left-3 text-lg font-medium text-cream">{category}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4 md:px-6">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Featured products</h2>
          <Link to="/shop" className="focus-ring rounded-sm text-sm text-charcoal/75 hover:text-ink hover:underline">
            View all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4 md:px-6">
        <div className="rounded-[1.75rem] bg-sand px-8 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-charcoal/70">Editorial</p>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">New Season, New Essentials</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-charcoal/80 md:text-base">
            A refreshed wardrobe in clean lines, grounded tones, and tactile fabrics created for motion and modern life.
          </p>
          <Link to="/collections" className="focus-ring mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-cream">
            Explore Collections
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4 md:px-6">
        <h2 className="mb-5 text-2xl font-semibold">Best sellers</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4 md:px-6">
        <div className="grid gap-4 rounded-xl2 border border-sand bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Free Shipping", "On orders over $75"],
            ["Easy Returns", "30-day return window"],
            ["Secure Checkout", "Encrypted payment protection"],
            ["Support", "Chat and email 7 days a week"],
          ].map(([title, subtitle]) => (
            <div key={title}>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-charcoal/70">{subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4 md:px-6">
        <h2 className="mb-5 text-2xl font-semibold">What customers say</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="rounded-xl2 border border-sand bg-white p-5">
              <p className="text-sm text-charcoal/85">“{item.quote}”</p>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-charcoal/60">{item.name}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-4 md:px-6">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Lookbook</h2>
          <a href="#" className="focus-ring rounded-sm text-sm text-charcoal/75 hover:text-ink hover:underline">
            @lumawear
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {lookbookImages.map((src, index) => (
            <img key={src} src={src} alt={`LumaWear lookbook ${index + 1}`} className="aspect-square rounded-xl2 object-cover" loading="lazy" />
          ))}
        </div>
      </section>

      <section className="mx-auto mb-4 mt-14 max-w-4xl px-4 md:px-6">
        <div className="rounded-[1.5rem] border border-sand bg-white p-6 text-center md:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-charcoal/70">Newsletter</p>
          <h2 className="mt-2 text-2xl font-semibold">Stay in the loop</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-charcoal/75">
            Be first to know about new drops, styling edits, and exclusive subscriber offers.
          </p>
          <form className="mx-auto mt-5 flex max-w-md flex-col gap-3 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              placeholder="Email address"
              className="focus-ring flex-1 rounded-full border border-sand bg-cream px-4 py-2 text-sm"
            />
            <button className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">Subscribe</button>
          </form>
        </div>
      </section>
    </div>
  );
}
