import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4">
      <section className="w-full max-w-md rounded-xl2 border border-sand bg-white p-6">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="mt-1 text-sm text-charcoal/70">Enter your email and we'll send reset instructions.</p>
        <form className="mt-5 space-y-4">
          <div>
            <label htmlFor="resetEmail" className="text-sm font-medium">
              Email
            </label>
            <input id="resetEmail" type="email" required className="focus-ring mt-1 w-full rounded-lg border border-sand px-3 py-2 text-sm" />
          </div>
          <button className="focus-ring w-full rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">Send reset link</button>
        </form>
        <Link to="/sign-in" className="focus-ring mt-4 inline-block rounded-sm text-sm text-charcoal/80 hover:text-ink hover:underline">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
