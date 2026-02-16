import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";

const app = express();

// CRITICAL: Stripe webhook needs raw body for signature verification
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Standard middleware for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

await registerRoutes(app);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

export default app;
