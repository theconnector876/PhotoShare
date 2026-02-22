import { useEffect } from 'react';

// In production, /checkout/* is handled server-side by the LS checkout proxy
// and this component never loads. In development it may appear; we just show a spinner.
export default function CheckoutOverlay() {
  useEffect(() => {
    // If somehow rendered in production (e.g. direct visit), redirect to dashboard
    const timer = setTimeout(() => {
      window.location.href = '/dashboard';
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground">Loading checkout...</p>
      </div>
    </div>
  );
}
