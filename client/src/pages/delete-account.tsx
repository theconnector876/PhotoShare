import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Warning, TrashSimple } from "@phosphor-icons/react";

export default function DeleteAccount() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirm !== "DELETE") return;
    setLoading(true);
    try {
      await apiRequest("DELETE", "/api/user/account");
      logoutMutation.mutate();
      toast({ title: "Account deleted", description: "Your account and data have been permanently removed." });
      setLocation("/");
    } catch {
      toast({ title: "Failed to delete account", description: "Please contact support@connectagrapher.com if this persists.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-16 pb-20 bg-background relative z-10">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <TrashSimple size={32} className="text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Delete Your Account</h1>
          <p className="text-muted-foreground">Permanently remove your ConnectAGrapher account and all associated data.</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-8 flex gap-3">
          <Warning size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">This action is permanent and cannot be undone.</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-400">
              <li>Your profile and account information will be deleted</li>
              <li>Your booking history will be removed</li>
              <li>Your photo galleries will be deleted</li>
              <li>Any active bookings may be cancelled</li>
            </ul>
          </div>
        </div>

        {!user ? (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">You must be logged in to delete your account.</p>
            <Button onClick={() => setLocation("/auth")}>Sign In</Button>
            <p className="text-sm text-muted-foreground mt-6">
              Or contact us directly at{" "}
              <a href="mailto:support@connectagrapher.com" className="text-amber-500 hover:underline">
                support@connectagrapher.com
              </a>{" "}
              to request account deletion.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Logged in as <strong className="text-foreground">{user.email}</strong>
              </p>
              <p className="text-sm font-medium text-foreground mb-2">
                Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-red-600">DELETE</span> to confirm:
              </p>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={confirm !== "DELETE" || loading}
              onClick={handleDelete}
            >
              <TrashSimple size={16} className="mr-2" />
              {loading ? "Deleting..." : "Permanently Delete My Account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Changed your mind?{" "}
              <button onClick={() => setLocation("/")} className="text-amber-500 hover:underline">
                Go back home
              </button>
            </p>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-border text-center text-xs text-muted-foreground">
          <p>
            Need help? Email us at{" "}
            <a href="mailto:support@connectagrapher.com" className="text-amber-500 hover:underline">
              support@connectagrapher.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
