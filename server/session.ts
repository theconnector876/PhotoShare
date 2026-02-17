import session from "express-session";
import connectPg from "connect-pg-simple";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const dbUrl = process.env.DATABASE_URL?.trim();

  let store: session.Store | undefined;
  if (dbUrl) {
    try {
      const pgStore = connectPg(session);
      store = new pgStore({
        conString: dbUrl,
        createTableIfMissing: true,
        ttl: sessionTtl,
        tableName: "sessions",
        errorLog: console.error.bind(console, "Session store error:"),
      });
    } catch (err) {
      console.error("Failed to create PG session store:", err);
    }
  }

  const opts: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  };

  if (store) {
    opts.store = store;
  }

  return session(opts);
}
