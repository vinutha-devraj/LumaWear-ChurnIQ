import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth(); const location = useLocation();
  if (loading) return <main className="p-8 text-center text-sm text-charcoal/70">Loading account…</main>;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location }} />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/account" replace />;
  return children;
}
