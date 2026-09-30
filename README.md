# 📝 NoteSphere

**NoteSphere** is a collaborative and personal notes web application featuring secure user authentication, a hybrid shared/private access model, live full-text search, and a modern responsive user interface.

---

## ✨ Features

- **🔐 User Authentication**:
  - Secure registration and login with salt + `scrypt` cryptographic password hashing.
  - JWT session tokens with both cookie and Bearer header support.
  - Custom avatar color preferences.
  - Pre-seeded demo user accounts for instant testing.

- **🌐 Hybrid Note Accessibility**:
  - **Shared Community Board**: Any note marked as "Shared" is instantly visible to **anyone who logs in**. Great for team announcements, roadmaps, and collaborative ideas.
  - **Private / Personal Notes**: Notes marked as "Private" are strictly accessible **only to the authenticated creator**.
  - Author attribution badges and creation/update timestamps.

- **💬 Shared Note Discussion**:
  - Emoji reactions on shared notes, with each user's reaction toggled on or off.
  - Comments on shared notes, with comment authors and timestamps.
  - Comment authors and note creators can delete comments.

- **⚡ Productivity & Organization**:
  - Live full-text search across titles, contents, tags, and authors.
  - Scope filters: *All Visible*, *Shared Board*, *My Private*, *Created By Me*.
  - Category filters: *General*, *Work*, *Ideas*, *Personal*, *Tasks*, *Study*.
  - Author dropdown filter.
  - Color accents: Default slate, Blue, Emerald, Amber, Purple, Rose.
  - 📌 Pinning notes to top.
  - Copy note content to clipboard with 1 click.
  - Download note as formatted `.md` (Markdown) file.
  - Export all accessible notes as `.json`.
  - Keyboard shortcuts: `Ctrl+N` to create a note, `Esc` to close modals.

- **🎨 Modern Responsive UI**:
  - Dark / Light mode toggle with persistent preferences.
  - Glassmorphism aesthetic with Tailwind CSS.
  - Instant floating toast notifications for user actions.
  - Mobile, tablet, and desktop responsive layout.

---

## 🚀 Quick Start

### Option 1: One-Click Run (Windows)
Double-click `start.bat` in this folder. It will start the server and automatically launch `http://localhost:3000` in your web browser.

### Option 2: Terminal / Command Line
1. Open PowerShell or Command Prompt in this folder.
2. Run:
   ```bash
   npm start
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Deployment Configuration

Set a private, persistent `JWT_SECRET` in the deployment environment before starting the server. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Local runs generate a temporary secret automatically, so sessions expire when the server restarts. Keep `data/notes-db.json` and all `.env` files private; they are excluded from the public repository.

---

## 🔑 Demo Accounts

The database comes pre-seeded with two demo accounts ready to test:

| Username | Password | Display Name | Sample Notes Included |
| :--- | :--- | :--- | :--- |
| `alice` | `password123` | Alice Walker | 1 Shared Welcome Note, 1 Private Grocery List |
| `bob` | `password123` | Bob Miller | 1 Shared Roadmap Note, 1 Private BBQ Recipe |

> **Tip:** You can also register any new account using the "Create Account" tab on the login screen.

---

## 📁 Project Architecture

```
.
├── server.js              # Express web server & REST API
├── package.json           # Dependencies and scripts
├── start.bat              # One-click Windows starter script
├── README.md              # Documentation
├── data/
│   └── notes-db.json      # Persistent JSON database (auto-generated)
├── lib/
│   ├── auth.js            # Scrypt password hashing & JWT utilities
│   ├── db.js              # Thread-safe atomic file-based database
│   └── seed.js            # Initial demo accounts & sample notes
└── public/
    ├── index.html         # Single Page Application HTML
    ├── css/
    │   └── style.css      # Custom styles & dark mode definitions
    └── js/
        ├── api.js         # Frontend API client
        └── app.js         # Frontend controller, state & UI interactions
```

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` — Register a new account (`username`, `name`, `password`, `avatarColor`).
- `POST /api/auth/login` — Sign in with credentials (`username`, `password`).
- `GET /api/auth/me` — Get profile for currently authenticated user.
- `POST /api/auth/logout` — Sign out and clear session cookie.
- `GET /api/users` — List registered public users (for author filtering).

### Notes (Protected)
- `GET /api/notes` — Get all accessible notes (shared notes + current user's private notes).
- `POST /api/notes` — Create note (`title`, `content`, `category`, `color`, `isShared`, `isPinned`).
- `PUT /api/notes/:id` — Update an existing note (author only).
- `PATCH /api/notes/:id/pin` — Toggle pin status (author only).
- `DELETE /api/notes/:id` — Delete note (author only).
- `GET /api/notes/export/json` — Download all accessible notes as JSON file.
- `POST /api/notes/:id/comments` — Add a comment to a shared note (or your own private note); comments are limited to 2,000 characters.
- `DELETE /api/notes/:id/comments/:commentId` — Delete your own comment, or any comment on a note you created.
- `POST /api/notes/:id/reactions` — Toggle one of the supported reactions (`👍`, `❤️`, `🚀`, `🎉`, `👀`).
