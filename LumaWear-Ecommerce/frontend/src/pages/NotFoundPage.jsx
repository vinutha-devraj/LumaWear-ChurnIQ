import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4">
      <section className="rounded-xl2 border border-sand bg-white p-8 text-center">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-charcoal/70">The page you are looking for does not exist.</p>
        <Link to="/" className="focus-ring mt-5 inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">
          Go home
        </Link>
      </section>
    </main>
  );
}
