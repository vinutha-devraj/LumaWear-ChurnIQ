import { Outlet } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import AnnouncementBar from "./AnnouncementBar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const { user, logActivity } = useAuth();
  const lastLoggedRouteRef = useRef("");

  useEffect(() => {
    if (!user) return;
    const currentRoute = `${location.pathname}${location.search}${location.hash}`;
    if (lastLoggedRouteRef.current !== currentRoute) {
      lastLoggedRouteRef.current = currentRoute;
      void logActivity({
        type: "page_view",
        route: currentRoute,
        metadata: { title: document.title },
      });
    }
  }, [location.pathname, location.search, location.hash, user]);

  return (
    <div className="min-h-screen bg-cream text-charcoal">
      <AnnouncementBar />
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <main>
        <Outlet />
      </main>
      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
