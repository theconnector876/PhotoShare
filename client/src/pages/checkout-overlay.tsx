import { useEffect } from 'react';

// This page handles connectagrapher.com/checkout/custom/:id — which Lemon Squeezy
// redirects to because it's configured as the store's custom domain.
// Instead of showing a 404, we intercept and open the LS overlay checkout.
export default function CheckoutOverlay() {
  useEffect(() => {
    const open = () => {
      const ls = window as any;
      if (ls.createLemonSqueezy) {
        ls.createLemonSqueezy();
        ls.LemonSqueezy?.Url?.Open(window.location.href);
      } else {
        // lemon.js not loaded yet — retry briefly
        setTimeout(open, 300);
      }
    };
    open();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">Opening secure checkout...</p>
      </div>
    </div>
  );
}
