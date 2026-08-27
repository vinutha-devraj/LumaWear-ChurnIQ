import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useStore } from "../context/StoreContext";
import QuantityStepper from "./QuantityStepper";

export default function CartDrawer({ open, onClose }) {
  const { cartItems, subtotal, shippingThreshold, updateCartQty, removeFromCart } = useStore();
  const missingForFreeShipping = Math.max(0, shippingThreshold - subtotal);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/30" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="ml-auto flex h-full w-[94%] max-w-md flex-col bg-cream p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your cart ({cartItems.length})</h2>
          <button className="focus-ring rounded-full p-2 hover:bg-sand/30" onClick={onClose} aria-label="Close cart">
            <X size={20} />
          </button>
        </div>
        {cartItems.length === 0 ? (
          <div className="rounded-xl2 border border-sand bg-white p-5 text-center">
            <p className="mb-3">Your cart is empty.</p>
            <Link to="/shop" className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 rounded-xl border border-sand bg-white p-3 text-xs">
              {missingForFreeShipping > 0
                ? `Add $${missingForFreeShipping.toFixed(2)} more for free shipping.`
                : "You unlocked free shipping."}
            </p>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {cartItems.map((item) => (
                <article key={item.id} className="rounded-xl2 border border-sand bg-white p-3">
                  <div className="flex gap-3">
                    <img src={item.product.image} alt={item.product.name} className="h-24 w-20 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-charcoal/70">
                        {item.color} / {item.size}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <QuantityStepper
                          value={item.quantity}
                          onChange={(value) => updateCartQty({ id: item.id, quantity: value })}
                        />
                        <p className="text-sm font-semibold">${item.lineTotal.toFixed(2)}</p>
                      </div>
                      <button
                        className="focus-ring mt-2 text-xs text-charcoal/70 hover:text-ink"
                        onClick={() => removeFromCart({ id: item.id })}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-4 space-y-3 rounded-xl2 border border-sand bg-white p-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <Link to="/cart" onClick={onClose} className="focus-ring block rounded-full border border-ink px-4 py-2 text-center text-sm font-medium">
                View cart
              </Link>
              <Link to="/checkout" onClick={onClose} className="focus-ring block rounded-full bg-ink px-4 py-2 text-center text-sm font-medium text-cream">
                Checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
