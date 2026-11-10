const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
const pool = require("../db");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    const extensions = allowedTypes[file.mimetype];
    const actualExtension = require("path")
      .extname(file.originalname)
      .toLowerCase();

    if (!extensions || !extensions.includes(actualExtension)) {
      return callback(
        new Error("Only JPG, PNG, WEBP, MP4 and WEBM files are allowed.")
      );
    }

    callback(null, true);
  }
});

function uploadToCloudinary(buffer, mediaType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "utaona-moto-wewe",
        resource_type: mediaType === "video" ? "video" : "image",
        public_id: crypto.randomUUID()
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

router.post("/", requireLogin, (req, res, next) => {
  upload.single("media")(req, res, error => {
    if (error) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "The file is too large. Maximum size is 50 MB."
        : error.message;

      return res.status(400).json({ error: message });
    }

    next();
  });
}, async (req, res) => {
  let uploadedAsset = null;

  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({
        error: "Media storage is not configured."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please select a photo or video."
      });
    }

    const isImage = req.file.mimetype.startsWith("image/");
    const isVideo = req.file.mimetype.startsWith("video/");

    if (isImage && req.file.size > 8 * 1024 * 1024) {
      return res.status(400).json({
        error: "Photos must not exceed 8 MB."
      });
    }

    const content = typeof req.body.content === "string"
      ? req.body.content.trim()
      : "";

    if (content.length > 2000) {
      return res.status(400).json({
        error: "Your caption must not exceed 2000 characters."
      });
    }

    const mediaType = isImage ? "image" : "video";

    uploadedAsset = await uploadToCloudinary(
      req.file.buffer,
      mediaType
    );

    const mediaUrl = uploadedAsset.secure_url;

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
    if (uploadedAsset && uploadedAsset.public_id) {
      const resourceType = uploadedAsset.resource_type || "image";

      await cloudinary.uploader.destroy(
        uploadedAsset.public_id,
        { resource_type: resourceType }
      ).catch(() => {});
    }

    console.error("Cloudinary media upload error:", error.message);

    res.status(500).json({
      error: "Could not publish your media. Please try again."
    });
  }
});

module.exports = router;
