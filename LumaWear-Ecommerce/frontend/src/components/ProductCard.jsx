import { Heart, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { useToast } from "../context/ToastContext";
import RatingStars from "./RatingStars";

const colorMap = {
  Ivory: "bg-stone-100",
  Taupe: "bg-stone-300",
  Black: "bg-zinc-900",
  Charcoal: "bg-zinc-700",
  Stone: "bg-stone-400",
  "Vintage Blue": "bg-blue-500",
  Ink: "bg-zinc-800",
  Terracotta: "bg-orange-400",
  White: "bg-white",
  Navy: "bg-blue-900",
  Sand: "bg-amber-200",
  Olive: "bg-lime-700",
  Ash: "bg-zinc-400",
  Beige: "bg-amber-100",
  Cream: "bg-neutral-100",
  Brown: "bg-yellow-900",
  Tan: "bg-amber-500",
  Clay: "bg-orange-300",
  Indigo: "bg-indigo-700",
  Espresso: "bg-amber-950",
  "Washed Black": "bg-zinc-700",
  Camel: "bg-yellow-700",
};

export default function ProductCard({ product }) {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const { addToast } = useToast();
  const inWishlist = wishlist.includes(product.id);
  const price = product.salePrice || product.price;

  return (
    <article className="group rounded-xl2 border border-sand bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
      <div className="relative overflow-hidden rounded-xl">
        <Link to={`/shop/${product.id}`}>
          <img
            src={product.image}
            alt={product.name}
            className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </Link>
        <button
          className={`focus-ring absolute right-2 top-2 rounded-full border border-white/70 bg-white/90 p-2 transition hover:bg-white ${
            inWishlist ? "text-ink" : "text-charcoal/70"
          }`}
          onClick={() => toggleWishlist({ productId: product.id })}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={16} className={inWishlist ? "fill-ink" : ""} />
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-xs uppercase tracking-wide text-charcoal/60">{product.category}</p>
        <Link to={`/shop/${product.id}`} className="focus-ring inline-block rounded-sm text-sm font-medium hover:underline">
          {product.name}
        </Link>
        <RatingStars value={product.rating} />
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-ink">${price}</span>
          {product.salePrice && <span className="text-charcoal/60 line-through">${product.price}</span>}
        </div>
        <div className="flex items-center gap-1">
          {product.colors.slice(0, 4).map((color) => (
            <span
              key={color}
              title={color}
              className={`h-3.5 w-3.5 rounded-full border border-charcoal/20 ${colorMap[color] || "bg-sand"}`}
            />
          ))}
        </div>
        <button
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-charcoal"
          onClick={() => {
            addToCart({
              productId: product.id,
              size: product.sizes[0],
              color: product.colors[0],
              quantity: 1,
            });
            addToast(`${product.name} added to cart`);
          }}
        >
          <ShoppingBag size={16} /> Quick Add
        </button>
      </div>
    </article>
  );
}
