
const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const pool = require("../db");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." }
});

function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg
    });
  }

  next();
}

// REGISTER
router.post(
  "/register",
  authLimiter,
  [
    body("fullName")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Enter your full name."),
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage("Enter a valid email address."),
    body("username")
      .trim()
      .matches(/^[a-zA-Z0-9_]{3,30}$/)
      .withMessage("Username must be 3–30 characters using letters, numbers or underscores."),
    body("password")
      .isLength({ min: 10, max: 72 })
      .withMessage("Password must be 10–72 characters.")
  ],
  validate,
  async (req, res) => {
    const { fullName, email, username, password } = req.body;

    try {
      const existing = await pool.query(
        `SELECT id FROM users WHERE email = $1
         UNION
         SELECT user_id AS id FROM profiles WHERE username = $2`,
        [email, username]
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({
          error: "That email or username is already registered."
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const userResult = await client.query(
          `INSERT INTO users (full_name, email, password_hash)
           VALUES ($1, $2, $3)
           RETURNING id, full_name, email, role`,
          [fullName, email, passwordHash]
        );

        const user = userResult.rows[0];

        await client.query(
          `INSERT INTO profiles (user_id, username)
           VALUES ($1, $2)`,
          [user.id, username]
        );

        await client.query("COMMIT");

        req.session.userId = user.id;

        return res.status(201).json({
          ok: true,
          message: "Account created successfully.",
          user
        });
      } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
          return res.status(409).json({
            error: "That email or username is already taken."
          });
        }

        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Registration error:", error.message);
      return res.status(500).json({
        error: "Registration could not be completed."
      });
    }
  }
);

// LOGIN
router.post(
  "/login",
  authLimiter,
  [
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage("Enter a valid email address."),
    body("password")
      .isLength({ min: 1, max: 72 })
      .withMessage("Enter your password.")
  ],
  validate,
  async (req, res) => {
    const { email, password } = req.body;

    try {
      const result = await pool.query(
        `SELECT id, full_name, email, password_hash, role
         FROM users
         WHERE email = $1 AND is_active = TRUE`,
        [email]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({
          error: "Invalid email or password."
        });
      }

      const user = result.rows[0];
      const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!passwordMatches) {
        return res.status(401).json({
          error: "Invalid email or password."
        });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session error:", err.message);
          return res.status(500).json({
            error: "Could not create a secure session."
          });
        }

        req.session.userId = user.id;

        return res.json({
          ok: true,
          message: "Login successful.",
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role
          }
        });
      });
    } catch (error) {
      console.error("Login error:", error.message);
      return res.status(500).json({
        error: "Login could not be completed."
      });
    }
  }
);

// CURRENT USER
router.get("/me", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      authenticated: false
    });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role,
              p.username, p.bio, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [req.session.userId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        authenticated: false
      });
    }

    return res.json({
      authenticated: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("User lookup error:", error.message);
    return res.status(500).json({
      error: "Could not load your account."
    });
  }
});

// LOGOUT
router.post("/logout", (req, res) => {
  if (!req.session) {
    return res.json({ ok: true });
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        error: "Logout failed."
      });
    }

    res.clearCookie("utaona.sid");
    return res.json({
      ok: true,
      message: "You have logged out."
    });
  });
});

module.exports = router;
