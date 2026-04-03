// ProtectedRoute component for email/password authentication - based on blueprint:javascript_auth_all_persistance
import { useAuth } from "@/hooks/use-auth";
import { CircleNotch as Loader2 } from "@phosphor-icons/react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  requireAdmin = false,
}: {
  path: string;
  component: () => React.JSX.Element | null;
  requireAdmin?: boolean;
}) {
  const { user, isLoading, isAdmin } = useAuth();

  return (
    <Route path={path}>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 size={32} className="animate-spin text-border" />
        </div>
      ) : !user ? (
        <Redirect to="/auth" />
      ) : requireAdmin && !isAdmin ? (
        <Redirect to="/" />
      ) : (
        <Component />
      )}
    </Route>
  );
}