import { Heart, ShieldCheck, Truck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import { useStore } from "../context/StoreContext";
import { useToast } from "../context/ToastContext";
import RatingStars from "../components/RatingStars";
import QuantityStepper from "../components/QuantityStepper";
import ProductCard from "../components/ProductCard";
import Accordion from "../components/Accordion";

export default function ProductDetailsPage() {
  const { productId } = useParams();
  const { products, wishlist, toggleWishlist, addToCart, recentlyViewed, addRecentlyViewed } = useStore();
  const { addToast } = useToast();
  const product = products.find((item) => item.id === productId);
  const [selectedImage, setSelectedImage] = useState(product?.images?.[0] || "");
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0] || "");
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.[0] || "");
  const [quantity, setQuantity] = useState(1);

  const loggedProductRef = useRef(null);

  useEffect(() => {
    if (product && loggedProductRef.current !== product.id) {
      loggedProductRef.current = product.id;
      setSelectedImage(product.images[0]);
      setSelectedColor(product.colors[0]);
      setSelectedSize(product.sizes[0]);
      addRecentlyViewed({ productId: product.id });
    }
  }, [product?.id, addRecentlyViewed]);

  const recommendations = useMemo(() => {
    if (!product) return [];
    return products
      .filter((item) => item.id !== product.id && (item.collection === product.collection || item.gender === product.gender))
      .slice(0, 4);
  }, [product, products]);

  const recent = useMemo(
    () => recentlyViewed.map((id) => products.find((item) => item.id === id)).filter((item) => item && item.id !== productId).slice(0, 4),
    [productId, products, recentlyViewed]
  );

  if (!product) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Product not found</h1>
        <Link to="/shop" className="focus-ring mt-4 inline-block rounded-full bg-ink px-6 py-2 text-sm font-medium text-cream">
          Back to shop
        </Link>
      </section>
    );
  }

  const currentPrice = product.salePrice || product.price;
  const inWishlist = wishlist.includes(product.id);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <img src={selectedImage} alt={product.name} className="aspect-[4/5] w-full rounded-xl2 object-cover" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            {product.images.map((image) => (
              <button
                key={image}
                className={`focus-ring overflow-hidden rounded-lg border ${
                  selectedImage === image ? "border-ink" : "border-sand"
                }`}
                onClick={() => setSelectedImage(image)}
                aria-label="Select product image"
              >
                <img src={image} alt="" className="aspect-[4/5] w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-charcoal/70">{product.category}</p>
          <h1 className="mt-1 text-3xl font-semibold">{product.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <RatingStars value={product.rating} />
            {product.salePrice && (
              <span className="rounded-full bg-muted/25 px-2 py-0.5 text-xs font-medium text-ink">
                Save ${product.price - product.salePrice}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-2xl font-semibold text-ink">
            <span>${currentPrice}</span>
            {product.salePrice && <span className="text-base font-normal text-charcoal/60 line-through">${product.price}</span>}
          </div>

          <p className="mt-5 text-sm font-medium">Color: {selectedColor}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`focus-ring rounded-full border px-3 py-1 text-xs transition ${
                  selectedColor === color ? "border-ink bg-ink text-cream" : "border-sand bg-white"
                }`}
              >
                {color}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm font-medium">Size</p>
            <button className="focus-ring rounded-sm text-xs text-charcoal/70 hover:text-ink hover:underline">Size guide</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`focus-ring rounded-lg border px-3 py-2 text-sm ${
                  selectedSize === size ? "border-ink bg-ink text-cream" : "border-sand bg-white hover:bg-sand/35"
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">Quantity</p>
            <QuantityStepper value={quantity} onChange={setQuantity} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="focus-ring rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition hover:bg-charcoal"
              onClick={() => {
                addToCart({ productId: product.id, color: selectedColor, size: selectedSize, quantity });
                addToast(`${product.name} added to cart`);
              }}
            >
              Add to Cart
            </button>
            <button
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-ink px-6 py-3 text-sm font-medium hover:bg-ink hover:text-cream"
              onClick={() => toggleWishlist({ productId: product.id })}
            >
              <Heart size={16} className={inWishlist ? "fill-current" : ""} /> {inWishlist ? "Wishlisted" : "Add to Wishlist"}
            </button>
          </div>

          <div className="mt-5 rounded-xl2 border border-sand bg-white p-4 text-sm">
            <p className={product.inStock ? "text-green-700" : "text-red-700"}>{product.inStock ? "In stock" : "Out of stock"}</p>
            <div className="mt-2 space-y-2 text-charcoal/75">
              <p className="inline-flex items-center gap-2">
                <Truck size={16} /> Shipping in 2-4 business days.
              </p>
              <p className="inline-flex items-center gap-2">
                <ShieldCheck size={16} /> Easy 30-day returns.
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm text-charcoal/80">{product.description}</p>
          <div className="mt-5">
            <Accordion
              items={[
                { title: "Material & care", content: product.materialCare },
                { title: "Fit information", content: product.fitInfo },
                {
                  title: "Shipping & returns",
                  content: "Free shipping over $75. Return within 30 days in original condition for a full refund.",
                },
              ]}
            />
          </div>
        </div>
      </div>

      <section className="mt-14">
        <h2 className="mb-5 text-2xl font-semibold">Complete the look</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recommendations.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-5 text-2xl font-semibold">You may also like</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products
            .filter((item) => item.id !== product.id)
            .slice(0, 4)
            .map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-2xl font-semibold">Recently viewed</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
