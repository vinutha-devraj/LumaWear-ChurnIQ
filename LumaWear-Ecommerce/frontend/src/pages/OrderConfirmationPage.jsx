import { CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function OrderConfirmationPage() {
  const { state } = useLocation();
  const orderNumber = state?.orderNumber || "LW-00000";
  const eta = state?.eta || "Arrives within 3-5 business days";

  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <div className="rounded-2xl border border-sand bg-white p-8 text-center">
        <CheckCircle2 size={44} className="mx-auto text-green-700" />
        <h1 className="mt-4 text-3xl font-semibold">Order confirmed</h1>
        <p className="mt-2 text-sm text-charcoal/70">Thank you for shopping with LumaWear.</p>
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-sand bg-cream p-4 text-left text-sm">
          <p>
            <strong>Order number:</strong> {orderNumber}
          </p>
          <p className="mt-1">
            <strong>Delivery estimate:</strong> {eta}
          </p>
          <p className="mt-1">
            <strong>Confirmation sent to:</strong> {state?.email || "your email address"}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/shop" className="focus-ring rounded-full bg-ink px-6 py-2 text-sm font-medium text-cream">
            Continue shopping
          </Link>
          <Link to="/account" className="focus-ring rounded-full border border-ink px-6 py-2 text-sm font-medium">
            View account
          </Link>
        </div>
      </div>
    </section>
  );
}
