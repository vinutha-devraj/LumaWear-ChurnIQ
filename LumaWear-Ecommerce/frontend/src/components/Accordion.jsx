import { ChevronDown } from "lucide-react";
import { useState } from "react";

export default function Accordion({ items }) {
  const [open, setOpen] = useState(items[0]?.title || "");

  return (
    <div className="divide-y divide-sand overflow-hidden rounded-xl2 border border-sand bg-white">
      {items.map((item) => {
        const isOpen = open === item.title;
        return (
          <div key={item.title}>
            <button
              className="focus-ring flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-sand/20"
              onClick={() => setOpen(isOpen ? "" : item.title)}
              aria-expanded={isOpen}
            >
              {item.title}
              <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && <div className="px-4 pb-4 text-sm text-charcoal/80">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
