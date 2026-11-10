+-
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const pool = require("../db");

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: "Please log in to continue."
    });
  }
  next();
}

function validPostId() {
  return param("postId")
    .isInt({ min: 1 })
    .withMessage("Invalid post ID.");
}

// GET COMMUNITY FEED
router.get("/", async (req, res) => {
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 20, 1),
    50
  );

  try {
    const result = await pool.query(
      `SELECT p.id, p.content, p.media_type, p.media_url,
              p.created_at, u.id AS user_id, u.full_name,
pr.username,
EXISTS (
  SELECT 1 FROM likes mine
  WHERE mine.post_id = p.id
  AND mine.user_id = $2
) AS liked_by_me,
(SELECT COUNT(*) FROM likes l
 WHERE l.post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments c
               WHERE c.post_id = p.id) AS comments_count
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE u.is_active = TRUE
       ORDER BY p.created_at DESC
       LIMIT $1`,
      [limit, req.session.userId || 0]
    );

    res.json({ ok: true, posts: result.rows });
  } catch (error) {
    console.error("Feed error:", error.message);
    res.status(500).json({ error: "Could not load community posts." });
  }
});

// CREATE TEXT POST
router.post(
  "/",
  requireLogin,
  body("content").trim().isLength({ min: 1, max: 2000 })
    .withMessage("A post must contain 1–2000 characters."),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const result = await pool.query(
        `INSERT INTO posts (user_id, content, media_type)
         VALUES ($1, $2, 'text')
         RETURNING id, user_id, content, media_type, created_at`,
        [req.session.userId, req.body.content.trim()]
      );

      res.status(201).json({
        ok: true,
        message: "Your post has been published.",
        post: result.rows[0]
      });
    } catch (error) {
      console.error("Post creation error:", error.message);
      res.status(500).json({ error: "Could not publish your post." });
    }
  }
);

// LIKE A POST
router.post(
  "/:postId/like",
  requireLogin,
  validPostId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid post ID." });
    }

    try {
      const postId = Number(req.params.postId);

      const result = await pool.query(
        `INSERT INTO likes (user_id, post_id)
         SELECT $1, id FROM posts WHERE id = $2
         ON CONFLICT (user_id, post_id) DO NOTHING
         RETURNING post_id`,
        [req.session.userId, postId]
      );

      const exists = await pool.query(
        "SELECT id FROM posts WHERE id = $1",
        [postId]
      );

      if (!exists.rowCount) {
        return res.status(404).json({ error: "Post not found." });
      }

      const count = await pool.query(
        "SELECT COUNT(*) AS likes_count FROM likes WHERE post_id = $1",
        [postId]
      );

      res.json({
        ok: true,
        liked: true,
        alreadyLiked: result.rowCount === 0,
        likesCount: Number(count.rows[0].likes_count)
      });
    } catch (error) {
      console.error("Like error:", error.message);
      res.status(500).json({ error: "Could not like this post." });
    }
  }
);

// UNLIKE A POST
router.delete(
  "/:postId/like",
  requireLogin,
  validPostId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid post ID." });
    }

    try {
      const postId = Number(req.params.postId);

      const exists = await pool.query(
        "SELECT id FROM posts WHERE id = $1",
        [postId]
      );

      if (!exists.rowCount) {
        return res.status(404).json({ error: "Post not found." });
      }

      await pool.query(
        "DELETE FROM likes WHERE user_id = $1 AND post_id = $2",
        [req.session.userId, postId]
      );

      const count = await pool.query(
        "SELECT COUNT(*) AS likes_count FROM likes WHERE post_id = $1",
        [postId]
      );

      res.json({
        ok: true,
        liked: false,
        likesCount: Number(count.rows[0].likes_count)
      });
    } catch (error) {
      console.error("Unlike error:", error.message);
      res.status(500).json({ error: "Could not unlike this post." });
    }
  }
);

// GET COMMENTS FOR A POST
router.get(
  "/:postId/comments",
  validPostId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid post ID." });
    }

    try {
      const postId = Number(req.params.postId);

      const result = await pool.query(
        `SELECT c.id, c.content, c.created_at,
                u.id AS user_id, u.full_name, pr.username
         FROM comments c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN profiles pr ON pr.user_id = u.id
         WHERE c.post_id = $1 AND u.is_active = TRUE
         ORDER BY c.created_at ASC
         LIMIT 100`,
        [postId]
      );

      res.json({ ok: true, comments: result.rows });
    } catch (error) {
      console.error("Comments error:", error.message);
      res.status(500).json({ error: "Could not load comments." });
    }
  }
);

// ADD A COMMENT
router.post(
  "/:postId/comments",
  requireLogin,
  validPostId(),
  body("content").trim().isLength({ min: 1, max: 1000 })
    .withMessage("A comment must contain 1–1000 characters."),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const postId = Number(req.params.postId);

      const result = await pool.query(
        `INSERT INTO comments (user_id, post_id, content)
         SELECT $1, id, $3 FROM posts WHERE id = $2
         RETURNING id, user_id, post_id, content, created_at`,
        [req.session.userId, postId, req.body.content.trim()]
      );

      if (!result.rowCount) {
        return res.status(404).json({ error: "Post not found." });
      }

      const count = await pool.query(
        "SELECT COUNT(*) AS comments_count FROM comments WHERE post_id = $1",
        [postId]
      );

      res.status(201).json({
        ok: true,
        message: "Comment added.",
        comment: result.rows[0],
        commentsCount: Number(count.rows[0].comments_count)
      });
    } catch (error) {
      console.error("Comment creation error:", error.message);
      res.status(500).json({ error: "Could not add your comment." });
    }
  }
);

module.exports = router
