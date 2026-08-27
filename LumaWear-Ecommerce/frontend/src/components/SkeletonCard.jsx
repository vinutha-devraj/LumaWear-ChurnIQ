export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl2 border border-sand bg-white p-3">
      <div className="aspect-[3/4] rounded-xl bg-sand/60" />
      <div className="mt-3 h-3 w-3/4 rounded bg-sand/70" />
      <div className="mt-2 h-3 w-1/2 rounded bg-sand/60" />
      <div className="mt-3 h-4 w-1/3 rounded bg-sand/70" />
    </div>
  );
}
