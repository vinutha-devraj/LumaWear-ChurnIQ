import { Star } from "lucide-react";

export default function RatingStars({ value }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rated ${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i + 1 <= Math.round(value);
        return (
          <Star
            key={i}
            size={14}
            className={filled ? "fill-muted text-muted" : "text-charcoal/35"}
            aria-hidden="true"
          />
        );
      })}
      <span className="ml-1 text-xs text-charcoal/70">{value.toFixed(1)}</span>
    </div>
  );
}
