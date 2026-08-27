import { Link } from "react-router-dom";
import { useState } from "react";
import { useStore } from "../context/StoreContext";
import QuantityStepper from "../components/QuantityStepper";

export default function CartPage() {
  const { cartItems, subtotal, shipping, discount, total, shippingThreshold, updateCartQty, removeFromCart } = useStore();
  const [coupon, setCoupon] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const extraCouponDiscount = couponMessage.includes("applied") ? Math.round(subtotal * 0.1) : 0;
  const finalTotal = Math.max(0, total - extraCouponDiscount);
  const remainingForFreeShipping = Math.max(0, shippingThreshold - subtotal);

  if (cartItems.length === 0) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-charcoal/70">Looks like you have not added anything yet.</p>
        <Link to="/shop" className="focus-ring mt-5 inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-cream">
          Continue shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <h1 className="text-3xl font-semibold">Shopping cart</h1>
      <p className="mt-2 rounded-xl border border-sand bg-white p-3 text-sm">
        {remainingForFreeShipping > 0
          ? `You are $${remainingForFreeShipping.toFixed(2)} away from free shipping.`
          : "Free shipping is unlocked."}
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {cartItems.map((item) => (
            <article key={item.id} className="rounded-xl2 border border-sand bg-white p-4">
              <div className="flex gap-4">
                <img src={item.product.image} alt={item.product.name} className="h-28 w-24 rounded-lg object-cover" />
                <div className="flex-1">
                  <h2 className="text-sm font-semibold">{item.product.name}</h2>
                  <p className="text-xs text-charcoal/70">
                    {item.color} / {item.size}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <QuantityStepper value={item.quantity} onChange={(value) => updateCartQty({ id: item.id, quantity: value })} />
                    <p className="text-sm font-semibold">${item.lineTotal.toFixed(2)}</p>
                  </div>
                  <button
                    className="focus-ring mt-3 rounded-sm text-xs text-charcoal/70 hover:text-ink hover:underline"
                    onClick={() => removeFromCart({ id: item.id })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-xl2 border border-sand bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-${discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Coupon</span>
              <span>-${extraCouponDiscount.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-4 border-t border-sand pt-4">
            <p className="flex justify-between font-semibold">
              <span>Total</span>
              <span>${finalTotal.toFixed(2)}</span>
            </p>
          </div>
          <div className="mt-4">
            <label htmlFor="coupon" className="text-sm font-medium">
              Discount code
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="coupon"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Enter code"
                className="focus-ring w-full rounded-full border border-sand bg-cream px-4 py-2 text-sm"
              />
              <button
                className="focus-ring rounded-full border border-ink px-4 py-2 text-sm"
                onClick={() => setCouponMessage(coupon.toUpperCase() === "LUMA10" ? "Coupon applied" : "Invalid code")}
              >
                Apply
              </button>
            </div>
            {couponMessage && <p className="mt-2 text-xs text-charcoal/70">{couponMessage}</p>}
          </div>
          <Link to="/checkout" className="focus-ring mt-5 block rounded-full bg-ink px-6 py-3 text-center text-sm font-semibold text-cream">
            Checkout
          </Link>
        </aside>
      </div>
    </section>
  );
}
