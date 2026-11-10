const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: "Please log in before uploading media."
    });
  }
  next();
}

const allowedTypes = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"]
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir);
  },
  filename: (req, file, callback) => {
    const extensions = allowedTypes[file.mimetype];
    const extension = extensions
      ? extensions[0]
      : ".bin";

    callback(
      null,
      crypto.randomUUID() + extension
    );
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    const extensions = allowedTypes[file.mimetype];
    const actualExtension = path.extname(file.originalname).toLowerCase();

    if (!extensions || !extensions.includes(actualExtension)) {
      return callback(
        new Error("Only JPG, PNG, WEBP, MP4 and WEBM files are allowed.")
      );
    }

    callback(null, true);
  }
});

router.post("/", requireLogin, (req, res, next) => {
  upload.single("media")(req, res, error => {
    if (error) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "The file is too large. Maximum video size is 50 MB."
        : error.message;

      return res.status(400).json({ error: message });
    }

    next();
  });
}, async (req, res) => {
  let savedFile = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Please select a photo or video."
      });
    }

    savedFile = req.file.path;

    const isImage = req.file.mimetype.startsWith("image/");
    const isVideo = req.file.mimetype.startsWith("video/");

    if (isImage && req.file.size > 8 * 1024 * 1024) {
      fs.unlink(savedFile, () => {});
      return res.status(400).json({
        error: "Photos must not exceed 8 MB."
      });
    }

    const content = typeof req.body.content === "string"
      ? req.body.content.trim()
      : "";

    if (content.length > 2000) {
      fs.unlink(savedFile, () => {});
      return res.status(400).json({
        error: "Your caption must not exceed 2000 characters."
      });
    }

    const mediaType = isImage ? "image" : "video";
    const mediaUrl = "/uploads/" + path.basename(req.file.filename);

    const result = await pool.query(
      `INSERT INTO posts (user_id, content, media_type, media_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, content, media_type, media_url, created_at`,
      [
        req.session.userId,
        content,
        mediaType,
        mediaUrl
      ]
    );

    res.status(201).json({
      ok: true,
      message: "Your media post has been published.",
      post: result.rows[0]
    });

  } catch (error) {
    if (savedFile) {
      fs.unlink(savedFile, () => {});
    }

    console.error("Media upload error:", error.message);

    res.status(500).json({
      error: "Could not publish your media. Please try again."
    });
  }
});

module.exports = router;
