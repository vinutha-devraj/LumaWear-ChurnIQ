import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { API_BASE_URL } from "../config/env";

const steps = ["Contact", "Shipping", "Payment", "Review"];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const { cartItems, subtotal, shipping, discount, total, clearCart } = useStore();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [orderError, setOrderError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    zip: "",
    country: "United States",
    payment: "card",
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        email: prev.email || user.email || "",
        firstName: prev.firstName || user.name?.split(" ")[0] || "",
        lastName: prev.lastName || user.name?.split(" ").slice(1).join(" ") || "",
      }));
    }
  }, [user]);

  const canCheckout = cartItems.length > 0;

  const validateStep = () => {
    // Validate only active step so users can progress with clear, targeted feedback.
    const nextErrors = {};
    if (step === 0) {
      if (!form.email.includes("@")) nextErrors.email = "Enter a valid email address.";
      if (!form.phone.trim()) nextErrors.phone = "Phone number is required.";
    }
    if (step === 1) {
      if (!form.firstName.trim()) nextErrors.firstName = "First name is required.";
      if (!form.lastName.trim()) nextErrors.lastName = "Last name is required.";
      if (!form.address.trim()) nextErrors.address = "Address is required.";
      if (!form.city.trim()) nextErrors.city = "City is required.";
      if (!form.zip.trim()) nextErrors.zip = "ZIP code is required.";
    }
    if (step === 2 && form.payment === "card") {
      if (!form.cardName.trim()) nextErrors.cardName = "Name on card is required.";
      if (form.cardNumber.replace(/\s/g, "").length < 16) nextErrors.cardNumber = "Card number must be 16 digits.";
      if (!form.expiry.trim()) nextErrors.expiry = "Expiry is required.";
      if (form.cvc.length < 3) nextErrors.cvc = "CVC must be at least 3 digits.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) {
      setStep((prev) => Math.min(3, prev + 1));
    }
  };

  const placeOrder = async () => {
    if (!validateStep()) return;
    setOrderError("");
    setIsSubmitting(true);
    try {
      const data = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cartItems.map(({ productId, quantity }) => ({ productId, quantity })),
          email: form.email,
          name: `${form.firstName} ${form.lastName}`.trim(),
        }),
      });
      const orderNumber = data.order?.orderNumber;
      if (!orderNumber) throw new Error("The order was created without an order number.");
      clearCart();
      navigate("/order-confirmation", {
        state: {
          orderNumber,
          email: form.email,
          eta: "Arrives between Aug 01 - Aug 04",
        },
      });
    } catch (error) {
      setOrderError(error.message || "Could not place your order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCheckout) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-14 text-center">
        <h1 className="text-2xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-charcoal/70">Add products to continue checkout.</p>
        <Link to="/shop" className="focus-ring mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">
          Shop products
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <h1 className="text-3xl font-semibold">Checkout</h1>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {steps.map((label, index) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 ${index <= step ? "bg-ink text-cream" : "border border-sand bg-white text-charcoal/70"}`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5 rounded-xl2 border border-sand bg-white p-5">
          <div className="rounded-xl border border-sand bg-cream p-4 text-sm">
            <p>
              Guest checkout enabled. Already have an account?{" "}
              <Link to="/sign-in" className="focus-ring rounded-sm font-medium underline">
                Sign in
              </Link>
            </p>
            {import.meta.env.DEV && <p className="mt-2 text-xs text-charcoal/65">API base URL: {API_BASE_URL}</p>}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Contact</h2>
              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.email ? "border-red-500" : "border-sand"}`}
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone
                </label>
                <input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.phone ? "border-red-500" : "border-sand"}`}
                />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Shipping</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="text-sm font-medium">
                    First name
                  </label>
                  <input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.firstName ? "border-red-500" : "border-sand"}`}
                  />
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className="text-sm font-medium">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.lastName ? "border-red-500" : "border-sand"}`}
                  />
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="address" className="text-sm font-medium">
                  Address
                </label>
                <input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.address ? "border-red-500" : "border-sand"}`}
                />
                {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="city" className="text-sm font-medium">
                    City
                  </label>
                  <input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.city ? "border-red-500" : "border-sand"}`}
                  />
                  {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
                </div>
                <div>
                  <label htmlFor="zip" className="text-sm font-medium">
                    ZIP
                  </label>
                  <input
                    id="zip"
                    value={form.zip}
                    onChange={(e) => setForm((prev) => ({ ...prev, zip: e.target.value }))}
                    className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.zip ? "border-red-500" : "border-sand"}`}
                  />
                  {errors.zip && <p className="mt-1 text-xs text-red-600">{errors.zip}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Payment</h2>
              <fieldset>
                <legend className="text-sm font-medium">Choose payment method</legend>
                <div className="mt-2 space-y-2">
                  {[
                    ["card", "Credit / Debit Card"],
                    ["paypal", "PayPal"],
                    ["applepay", "Apple Pay / Google Pay"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-sand p-3 text-sm">
                      <input
                        type="radio"
                        name="payment"
                        checked={form.payment === value}
                        onChange={() => setForm((prev) => ({ ...prev, payment: value }))}
                        className="h-4 w-4 text-ink focus:ring-ink"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {form.payment === "card" && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="cardName" className="text-sm font-medium">
                      Name on card
                    </label>
                    <input
                      id="cardName"
                      value={form.cardName}
                      onChange={(e) => setForm((prev) => ({ ...prev, cardName: e.target.value }))}
                      className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.cardName ? "border-red-500" : "border-sand"}`}
                    />
                    {errors.cardName && <p className="mt-1 text-xs text-red-600">{errors.cardName}</p>}
                  </div>
                  <div>
                    <label htmlFor="cardNumber" className="text-sm font-medium">
                      Card number
                    </label>
                    <input
                      id="cardNumber"
                      value={form.cardNumber}
                      onChange={(e) => setForm((prev) => ({ ...prev, cardNumber: e.target.value }))}
                      className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.cardNumber ? "border-red-500" : "border-sand"}`}
                    />
                    {errors.cardNumber && <p className="mt-1 text-xs text-red-600">{errors.cardNumber}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="expiry" className="text-sm font-medium">
                        Expiry
                      </label>
                      <input
                        id="expiry"
                        value={form.expiry}
                        onChange={(e) => setForm((prev) => ({ ...prev, expiry: e.target.value }))}
                        className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.expiry ? "border-red-500" : "border-sand"}`}
                        placeholder="MM/YY"
                      />
                      {errors.expiry && <p className="mt-1 text-xs text-red-600">{errors.expiry}</p>}
                    </div>
                    <div>
                      <label htmlFor="cvc" className="text-sm font-medium">
                        CVC
                      </label>
                      <input
                        id="cvc"
                        value={form.cvc}
                        onChange={(e) => setForm((prev) => ({ ...prev, cvc: e.target.value }))}
                        className={`focus-ring mt-1 w-full rounded-lg border px-3 py-2 text-sm ${errors.cvc ? "border-red-500" : "border-sand"}`}
                      />
                      {errors.cvc && <p className="mt-1 text-xs text-red-600">{errors.cvc}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Review your order</h2>
              <div className="rounded-xl border border-sand bg-cream p-4 text-sm">
                <p>
                  <strong>Contact:</strong> {form.email} · {form.phone}
                </p>
                <p className="mt-1">
                  <strong>Ship to:</strong> {form.firstName} {form.lastName}, {form.address}, {form.city} {form.zip}
                </p>
                <p className="mt-1">
                  <strong>Payment:</strong> {form.payment === "card" ? "Card" : form.payment === "paypal" ? "PayPal" : "Apple/Google Pay"}
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                {cartItems.map((item) => (
                  <li key={item.id} className="flex justify-between rounded-lg border border-sand bg-cream p-2">
                    <span>
                      {item.product.name} ({item.size}, {item.color}) x {item.quantity}
                    </span>
                    <span>${item.lineTotal.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2 border-t border-sand pt-4">
            <button
              className="focus-ring rounded-full border border-sand px-5 py-2 text-sm hover:bg-sand/30 disabled:opacity-50"
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              disabled={step === 0}
            >
              Back
            </button>
            {step < 3 ? (
              <button className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream" onClick={next}>
                Continue
              </button>
            ) : (
              <button
                className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream disabled:opacity-50"
                onClick={placeOrder}
                disabled={isSubmitting}
              >
                Place Order
              </button>
            )}
          </div>
          {orderError && <p className="text-sm text-red-600" role="alert">{orderError}</p>}
        </div>

        <aside className="h-fit rounded-xl2 border border-sand bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {cartItems.map((item) => (
              <li key={item.id} className="flex gap-2 text-sm">
                <img src={item.product.image} alt={item.product.name} className="h-14 w-12 rounded object-cover" />
                <div className="flex-1">
                  <p>{item.product.name}</p>
                  <p className="text-xs text-charcoal/65">
                    {item.size} / {item.color} x {item.quantity}
                  </p>
                </div>
                <p className="font-medium">${item.lineTotal.toFixed(2)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-sand pt-4 text-sm">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </p>
            <p className="flex justify-between">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
            </p>
            <p className="flex justify-between">
              <span>Discount</span>
              <span>-${discount.toFixed(2)}</span>
            </p>
            <p className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
