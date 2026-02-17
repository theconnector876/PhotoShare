import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";

const app = express();

// Lemon Squeezy webhook needs raw body for signature verification
app.use("/api/lemonsqueezy/webhook", express.raw({ type: "application/json" }));

// Standard middleware for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize routes - must complete before handling requests
let initialized = false;
let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = registerRoutes(app)
      .then(() => {
        initialized = true;
        console.log("Routes initialized successfully");
      })
      .catch((err) => {
        initError = err;
        console.error("Route initialization failed:", err);
      });
  }
  return initPromise;
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Vercel handler - ensure routes are initialized before handling
const handler = async (req: Request, res: Response) => {
  try {
    await ensureInitialized();
    if (initError) {
      return res.status(500).json({
        error: "Server initialization failed",
        details: initError.message,
        stack: initError.stack
      });
    }
    app(req, res);
  } catch (error: any) {
    console.error("Handler error:", error);
    res.status(500).json({
      error: "Handler error",
      details: error.message,
      stack: error.stack
    });
  }
};

export default handler;
