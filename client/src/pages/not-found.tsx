import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 pb-6">
          <div className="flex mb-4 gap-3 items-center">
            <AlertCircle className="h-8 w-8 text-amber-400 shrink-0" />
            <h1 className="text-2xl font-bold text-white">404 — Page Not Found</h1>
          </div>
          <p className="mt-2 text-sm text-white/45">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <a href="/" className="mt-6 inline-block text-sm text-amber-400 hover:text-amber-300 transition-colors">
            ← Back to Home
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
