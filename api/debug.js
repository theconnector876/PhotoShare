export default async function handler(req, res) {
  const dbUrl = process.env.DATABASE_URL || "";
  const envCheck = {
    DATABASE_URL_length: dbUrl.length,
    DATABASE_URL_first30: dbUrl.substring(0, 30),
    DATABASE_URL_last10: dbUrl.substring(dbUrl.length - 10),
    DATABASE_URL_hasNewline: dbUrl.includes('\n'),
    DATABASE_URL_trimmed_length: dbUrl.trim().length,
    SESSION_SECRET: process.env.SESSION_SECRET ? "set" : "NOT SET",
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID || "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
  };

  try {
    // Test URL parsing with trimmed value
    const testUrl = new URL(dbUrl.trim());
    envCheck.DATABASE_URL_host = testUrl.hostname;
  } catch (e) {
    envCheck.DATABASE_URL_parse_error = e.message;
  }

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
    });
  }
}
