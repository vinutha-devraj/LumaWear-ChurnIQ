export default function QuantityStepper({ value, onChange, label = "Quantity" }) {
  return (
    <div className="inline-flex items-center rounded-full border border-sand bg-white">
      <button
        className="focus-ring rounded-l-full px-3 py-2 text-charcoal hover:bg-sand/40"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label={`Decrease ${label}`}
      >
        -
      </button>
      <span className="min-w-10 text-center text-sm font-medium">{value}</span>
      <button
        className="focus-ring rounded-r-full px-3 py-2 text-charcoal hover:bg-sand/40"
        onClick={() => onChange(value + 1)}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}
