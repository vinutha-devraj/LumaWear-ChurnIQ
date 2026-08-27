import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import ProductCard from "../components/ProductCard";

export default function AccountDashboardPage() {
  const { user, signOut } = useAuth();
  const { wishlist, products } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const wishlistProducts = products.filter((product) => wishlist.includes(product.id));

  const logout = () => {
    signOut();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (location.hash === "#wishlist") {
      const el = document.getElementById("wishlist");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location.hash]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">My account</h1>
          <p className="text-sm text-charcoal/70">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-2">
          {user?.role === "admin" && (
            <Link to="/admin" className="focus-ring rounded-full border border-ink px-5 py-2 text-sm font-medium">
              Admin dashboard
            </Link>
          )}
          <button onClick={logout} className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">
            Logout
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-xl2 border border-sand bg-white p-5">
          <h2 className="text-lg font-semibold">Profile details</h2>
          <p className="mt-3 text-sm">
            <strong>Name:</strong> {user?.name}
          </p>
          <p className="mt-1 text-sm">
            <strong>Email:</strong> {user?.email}
          </p>
          <p className="mt-1 text-sm">
            <strong>Account type:</strong> {user?.role}
          </p>
        </article>

        <article className="rounded-xl2 border border-sand bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Your account is ready</h2>
          <p className="mt-3 text-sm text-charcoal/70">
            Your sign-in is stored securely by the server. Orders and saved addresses can be managed directly from your account.
          </p>
        </article>
      </div>

      <section id="wishlist" className="mt-8">
        <h2 className="mb-4 text-2xl font-semibold">Wishlist ({wishlistProducts.length})</h2>
        {wishlistProducts.length === 0 ? (
          <div className="rounded-xl2 border border-sand bg-white p-6 text-center">
            <p className="text-sm text-charcoal/75">No items in your wishlist yet.</p>
            <Link to="/shop" className="focus-ring mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {wishlistProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

