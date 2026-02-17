export default async function handler(req, res) {
  const envCheck = {
    DATABASE_URL: process.env.DATABASE_URL ? "set (" + process.env.DATABASE_URL.substring(0, 20) + "...)" : "NOT SET",
    SESSION_SECRET: process.env.SESSION_SECRET ? "set" : "NOT SET",
    LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY ? "set" : "NOT SET",
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID || "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
    APP_URL: process.env.APP_URL || "NOT SET",
  };

  try {
    const app = await import('./server.cjs');
    res.status(200).json({
      status: "loaded",
      hasDefault: typeof app.default === 'function',
      env: envCheck
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      env: envCheck,
      stack: error.stack?.split('\n').slice(0, 5)
    });
  }
}
