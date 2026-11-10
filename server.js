
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      mediaSrc: ["'self'", "https:", "blob:"],
      connectSrc: ["'self'", "https:"]
    }
  }
}));

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

// PostgreSQL-backed login sessions
app.use(session({
  name: "utaona.sid",
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Authentication routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/media", require("./routes/media"));
// Health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      name: "UTAONA MOTO WEWE",
      status: "running",
      database: "connected",
      authentication: "configured"
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    res.status(503).json({
      ok: false,
      database: "disconnected"
    });
  }
});

// Uploaded photos and videos
app.use("/uploads", express.static(
  path.join(__dirname, "uploads"),
  {
    dotfiles: "deny",
    index: false,
    maxAge: "1d"
  }
));

// Public website files
app.use(express.static(path.join(__dirname, "public")));
// Unknown API routes should return JSON
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API endpoint not found."
  });
});

// Website homepage
app.get("/{*splat}", (req, res, next) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html"),
    (error) => {
      if (error) next(error);
    }
  );
});

// Error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (res.headersSent) return next(error);

  res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("UTAONA MOTO WEWE running on port " + PORT);
});
