import { Facebook, Instagram, Twitter } from "lucide-react";
import { Link } from "react-router-dom";

const groups = [
  { title: "Shop", links: ["New Arrivals", "Women", "Men", "Accessories", "Sale"] },
  { title: "Company", links: ["About", "Journal", "Sustainability", "Careers", "Contact"] },
  { title: "Support", links: ["Help Center", "Shipping", "Returns", "Size Guide", "Track Order"] },
];

export default function Footer() {
  return (
    <footer className="mt-14 border-t border-sand bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold">LumaWear</h2>
          <p className="mt-3 max-w-md text-sm text-charcoal/75">
            Elevated essentials for modern wardrobes. Thoughtful silhouettes, premium comfort, and refined daily style.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <a href="#" className="focus-ring rounded-full border border-sand p-2 hover:bg-sand/30" aria-label="Instagram">
              <Instagram size={16} />
            </a>
            <a href="#" className="focus-ring rounded-full border border-sand p-2 hover:bg-sand/30" aria-label="Facebook">
              <Facebook size={16} />
            </a>
            <a href="#" className="focus-ring rounded-full border border-sand p-2 hover:bg-sand/30" aria-label="Twitter">
              <Twitter size={16} />
            </a>
          </div>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-charcoal/75">
              {group.links.map((item) => (
                <li key={item}>
                  <Link to="/shop" className="focus-ring rounded-sm hover:text-ink hover:underline">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-sand">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-charcoal/70 md:flex-row md:items-center md:justify-between md:px-6">
          <p>© {new Date().getFullYear()} LumaWear. All rights reserved.</p>
          <p>support@lumawear.com · +1 (212) 555-0189 · 24 Mercer St, NY</p>
          <p>Payments: Visa · Mastercard · PayPal · Apple Pay · Google Pay</p>
        </div>
      </div>
    </footer>
  );
}
