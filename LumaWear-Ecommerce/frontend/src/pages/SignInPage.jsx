import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SignInPage() {
  const { signIn } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" }); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await signIn(form);
      const redirectTarget = location.state?.from
        ? `${location.state.from.pathname || "/account"}${location.state.from.search || ""}${location.state.from.hash || ""}`
        : "/account";
      navigate(user.role === "admin" ? "/admin" : redirectTarget, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };
  return <main className="flex min-h-screen items-center justify-center bg-cream p-4"><section className="w-full max-w-md rounded-xl2 border border-sand bg-white p-6"><h1 className="text-2xl font-semibold">Sign in</h1><p className="mt-1 text-sm text-charcoal/70">Access your orders and wishlist.</p><form onSubmit={submit} className="mt-5 space-y-4"><div><label htmlFor="signInEmail" className="text-sm font-medium">Email</label><input id="signInEmail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="focus-ring mt-1 w-full rounded-lg border border-sand px-3 py-2 text-sm" /></div><div><div className="flex items-center justify-between"><label htmlFor="signInPassword" className="text-sm font-medium">Password</label><Link to="/forgot-password" className="focus-ring rounded-sm text-xs text-charcoal/70 hover:text-ink hover:underline">Forgot password?</Link></div><input id="signInPassword" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="focus-ring mt-1 w-full rounded-lg border border-sand px-3 py-2 text-sm" /></div>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}<button disabled={submitting} className="focus-ring w-full rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream disabled:opacity-60">{submitting ? "Signing in…" : "Sign in"}</button></form><p className="mt-4 text-sm text-charcoal/70">New to LumaWear? <Link to="/sign-up" className="focus-ring rounded-sm font-medium text-ink underline">Create account</Link></p></section></main>;
}
