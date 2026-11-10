
const modal = document.getElementById("authModal");
const form = document.getElementById("authForm");
const nameField = document.getElementById("nameField");
const usernameField = document.getElementById("usernameField");
const fullName = document.getElementById("fullName");
const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const title = document.getElementById("modalTitle");
const description = document.getElementById("modalDescription");
const submit = document.getElementById("authSubmit");
const message = document.getElementById("formMessage");
const switchButton = document.getElementById("switchAuth");
const loginButton = document.getElementById("loginOpen");
const registerButton = document.getElementById("registerOpen");

let mode = "register";
let currentUser = null;

document.getElementById("year").textContent =
  new Date().getFullYear();

function showMessage(text, success = false) {
  message.textContent = text;
  message.style.color = success ? "#16803c" : "#c62828";
}

function openModal(selectedMode) {
  mode = selectedMode;
  updateModal();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function updateModal() {
  const registering = mode === "register";

  title.textContent = registering
    ? "Join our community"
    : "Welcome back";

  description.textContent = registering
    ? "Create your account and start sharing."
    : "Log in to your account.";

  nameField.style.display = registering ? "grid" : "none";
  usernameField.style.display = registering ? "grid" : "none";

  fullName.required = registering;
  username.required = registering;

  password.minLength = 10;
  password.autocomplete = registering
    ? "new-password"
    : "current-password";

  submit.textContent = registering
    ? "Create account"
    : "Log in";

  switchButton.textContent = registering
    ? "Already have an account? Log in"
    : "New here? Create an account";

  message.textContent = "";
}

async function apiRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };

  // FormData must set its own multipart Content-Type boundary.
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers
  });

  const data = await response.json().catch(() => ({
    error: "The server returned an invalid response."
  }));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data; }

function setAuthenticated(user) {
  currentUser = user;
  loginButton.textContent = "My account";
  registerButton.textContent = "Log out";
}

function setLoggedOut() {
  currentUser = null;
  loginButton.textContent = "Log in";
  registerButton.textContent = "Join now";
}

async function checkSession() {
  try {
    const data = await apiRequest("/api/auth/me", {
      method: "GET",
      headers: {}
    });

    if (data.authenticated) {
      setAuthenticated(data.user);
    } else {
      setLoggedOut();
    }
  } catch {
    setLoggedOut();
  }
}

// Open registration buttons
[
  "heroJoin",
  "feedJoin",
  "emptyJoin",
  "bottomJoin"
].forEach(id => {
  const button = document.getElementById(id);

  if (button) {
    button.addEventListener("click", () => {
      openModal("register");
    });
  }
});

loginButton.addEventListener("click", () => {
  if (currentUser) {
    openModal("login");
    showMessage(
      "Logged in as " + currentUser.full_name,
      true
    );
  } else {
    openModal("login");
  }
});

registerButton.addEventListener("click", async () => {
  if (!currentUser) {
    openModal("register");
    return;
  }

  try {
    await apiRequest("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });

    setLoggedOut();
    closeModal();
    form.reset();
    alert("You have logged out successfully.");
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("closeModal").addEventListener(
  "click",
  closeModal
);

modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

switchButton.addEventListener("click", () => {
  mode = mode === "register" ? "login" : "register";
  updateModal();
});

document.getElementById("menuButton").addEventListener(
  "click",
  () => {
    document.getElementById("navigation")
      .classList.toggle("open");
  }
);

document.querySelectorAll("#navigation a").forEach(link => {
  link.addEventListener("click", () => {
    document.getElementById("navigation")
      .classList.remove("open");
  });
});

// Registration and login submission
form.addEventListener("submit", async event => {
  event.preventDefault();

  const registering = mode === "register";

  const payload = {
    email: email.value.trim(),
    password: password.value
  };

  if (registering) {
    payload.fullName = fullName.value.trim();
    payload.username = username.value.trim();
  }

  submit.disabled = true;
  submit.textContent = "Please wait...";
  showMessage("Connecting securely...");

  try {
    const endpoint = registering
      ? "/api/auth/register"
      : "/api/auth/login";

    const data = await apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setAuthenticated(data.user);

    showMessage(data.message, true);
    form.reset();

    setTimeout(() => {
      closeModal();
    }, 1200);

  } catch (error) {
    showMessage(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = registering
      ? "Create account"
      : "Log in";
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

checkSession();


// UTAONA MOTO WEWE COMMUNITY FEED

const postForm = document.getElementById("postForm");
const postMedia = document.getElementById("postMedia");
const mediaPreview = document.getElementById("mediaPreview");
let previewObjectUrl = null;
const postContent = document.getElementById("postContent");
const postMessage = document.getElementById("postMessage");
const communityFeed = document.getElementById("communityFeed");
const characterCount = document.getElementById("characterCount");
const publishPost = document.getElementById("publishPost");
const postComposer = document.getElementById("postComposer");
if (postMedia && mediaPreview) {
  postMedia.addEventListener("change", () => {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }

    mediaPreview.replaceChildren();

    const file = postMedia.files[0];
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm"
    ];

    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? 8 * 1024 * 1024 : 50 * 1024 * 1024;

    if (!allowedTypes.includes(file.type) || file.size > maxSize) {
      postMessage.textContent = "Unsupported file or file too large.";
      postMedia.value = "";
      return;
    }

    previewObjectUrl = URL.createObjectURL(file);

    const preview = document.createElement(
      isImage ? "img" : "video"
    );

    preview.src = previewObjectUrl;
    preview.alt = "Selected media preview";

    if (!isImage) {
      preview.controls = true;
    }

    mediaPreview.appendChild(preview);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove media";

    removeButton.addEventListener("click", () => {
      postMedia.value = "";
      mediaPreview.replaceChildren();
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    });

    mediaPreview.appendChild(removeButton);
    postMessage.textContent = "";
  });
}
if (postForm && communityFeed) {
  postComposer.style.display = currentUser ? "block" : "none";

  postContent.addEventListener("input", () => {
    characterCount.textContent = postContent.value.length + " / 2000";
  });

  async function loadCommunityFeed() {
    communityFeed.textContent = "Loading community posts...";

    try {
      const data = await apiRequest("/api/posts", {
        method: "GET",
        headers: {}
      });

      if (!data.posts.length) {
        communityFeed.innerHTML = `
          <div class="feed-placeholder">
            <div class="placeholder-icon">✦</div>
            <h3>No posts yet</h3>
            <p>Be the first to share something with the community.</p>
          </div>
        `;
        return;
      }

      communityFeed.replaceChildren();

      data.posts.forEach(post => {
        const card = document.createElement("article");
        card.className = "post-card";
        card.dataset.postId = post.id;

        const author = document.createElement("strong");
        author.textContent = post.full_name || post.username || "Community member";

        const date = document.createElement("small");
        date.textContent = new Date(post.created_at).toLocaleString();

const content = document.createElement("p");
content.textContent = post.content || "";

const stats = document.createElement("div");        stats.className = "post-stats";
        stats.textContent =
          `${post.likes_count} likes · ${post.comments_count} comments`;

        const actions = document.createElement("div");
        actions.className = "post-actions";

        const likeButton = document.createElement("button");
        likeButton.type = "button";
        likeButton.className = "outline-button like-button";
        likeButton.dataset.action = "like";
        likeButton.textContent = post.liked_by_me ? "♥ Unlike" : "♡ Like";

        const commentButton = document.createElement("button");
        commentButton.type = "button";
        commentButton.className = "outline-button";
        commentButton.dataset.action = "comments";
        commentButton.textContent = "💬 Comments";

        actions.append(likeButton, commentButton);

        const commentsPanel = document.createElement("div");
        commentsPanel.className = "comments-panel";
        commentsPanel.hidden = true;

card.append(author, date);

if (post.content) {
  card.appendChild(content);
}

if (post.media_url && post.media_type === "image") {
  const image = document.createElement("img");
  image.src = post.media_url;
  image.alt = "Community photo";
  image.loading = "lazy";
  image.className = "post-media";
  card.appendChild(image);
}

if (post.media_url && post.media_type === "video") {
  const video = document.createElement("video");
  video.src = post.media_url;
  video.controls = true;
  video.preload = "metadata";
  video.playsInline = true;
  video.className = "post-media";
  card.appendChild(video);
}

card.append(stats, actions, commentsPanel);        communityFeed.appendChild(card);
      });

    } catch (error) {
      communityFeed.textContent = error.message;
    }
  }

  async function loadComments(postId, panel) {
    panel.textContent = "Loading comments...";

    try {
      const data = await apiRequest(
        `/api/posts/${postId}/comments`,
        { method: "GET", headers: {} }
      );

      panel.replaceChildren();

      if (!data.comments.length) {
        const empty = document.createElement("p");
        empty.textContent = "No comments yet. Start the conversation!";
        panel.appendChild(empty);
      }

      data.comments.forEach(comment => {
        const item = document.createElement("div");
        item.className = "comment-item";

        const name = document.createElement("strong");
        name.textContent =
          comment.full_name || comment.username || "Community member";

        const message = document.createElement("p");
        message.textContent = comment.content;

        const time = document.createElement("small");
        time.textContent = new Date(comment.created_at).toLocaleString();

        item.append(name, message, time);
        panel.appendChild(item);
      });

      if (currentUser) {
        const form = document.createElement("form");
        form.className = "comment-form";

        const input = document.createElement("input");
        input.type = "text";
        input.name = "content";
        input.maxLength = 1000;
        input.placeholder = "Write a comment...";
        input.required = true;

        const button = document.createElement("button");
        button.type = "submit";
        button.className = "primary-button";
        button.textContent = "Comment";

        form.append(input, button);
        panel.appendChild(form);
      } else {
        const note = document.createElement("p");
        note.textContent = "Log in to join the conversation.";
        panel.appendChild(note);
      }

    } catch (error) {
      panel.textContent = error.message;
    }
  }

  // HANDLE LIKE AND COMMENT BUTTONS
  communityFeed.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest(".post-card");
    if (!card) return;

    const postId = card.dataset.postId;

    if (!currentUser) {
      openModal("login");
      showMessage("Please log in to interact with posts.");
      return;
    }

    if (button.dataset.action === "like") {
      button.disabled = true;

      try {
        const isLiked = button.textContent.includes("Unlike");

        await apiRequest(
          `/api/posts/${postId}/like`,
          {
            method: isLiked ? "DELETE" : "POST"
          }
        );

        await loadCommunityFeed();

      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    }

    if (button.dataset.action === "comments") {
      const panel = card.querySelector(".comments-panel");
      panel.hidden = !panel.hidden;

      if (!panel.hidden) {
        await loadComments(postId, panel);
      }
    }
  });

  // HANDLE NEW COMMENTS
  communityFeed.addEventListener("submit", async event => {
    if (!event.target.matches(".comment-form")) return;

    event.preventDefault();

    const form = event.target;
    const card = form.closest(".post-card");
    const postId = card.dataset.postId;
    const input = form.elements.content;
    const button = form.querySelector("button");

    if (!input.value.trim()) return;

    button.disabled = true;
    button.textContent = "Sending...";

    try {
      await apiRequest(
        `/api/posts/${postId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            content: input.value.trim()
          })
        }
      );

      await loadCommunityFeed();

      const updatedCard = communityFeed.querySelector(
        `[data-post-id="${postId}"]`
      );

      if (updatedCard) {
        const panel = updatedCard.querySelector(".comments-panel");
        panel.hidden = false;
        await loadComments(postId, panel);
      }

    } catch (error) {
      alert(error.message);
      button.disabled = false;
      button.textContent = "Comment";
    }
  });

  // PUBLISH POSTS
postForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    postMessage.textContent = "Please log in before publishing.";
    return;
  }

  const content = postContent.value.trim();
  const file = postMedia?.files?.[0];

  if (!content && !file) {
    postMessage.textContent = "Write something or select a photo/video.";
    return;
  }

  publishPost.disabled = true;
  publishPost.textContent = "Publishing...";

  try {
    if (file) {
      const formData = new FormData();
      formData.append("media", file);
      formData.append("content", content);

      await apiRequest("/api/media", {
        method: "POST",
        body: formData
      });
    } else {
      await apiRequest("/api/posts", {
        method: "POST",
        body: JSON.stringify({ content })
      });
    }

    postForm.reset();
    characterCount.textContent = "0 / 2000";

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }

    if (mediaPreview) {
      mediaPreview.replaceChildren();
    }

    postMessage.textContent = "Your post has been published!";
    await loadCommunityFeed();

  } catch (error) {
    postMessage.textContent = error.message;
  } finally {
    publishPost.disabled = false;
    publishPost.textContent = "Publish post";
  }
});
}
