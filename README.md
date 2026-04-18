# Descall — Backend Auth Guide

## Project Structure

```
descall_backend/
├── src/
│   ├── index.js              # Entry point (Express + Socket.io)
│   ├── config/
│   │   └── jwt.js            # signToken / verifyToken helpers
│   ├── db/
│   │   └── supabase.js       # Supabase client singleton
│   ├── middleware/
│   │   ├── auth.js           # Express JWT middleware (requireAuth)
│   │   └── socketAuth.js     # Socket.io JWT middleware
│   └── routes/
│       └── auth.js           # POST /register  POST /login
├── .env.example
├── .gitignore
└── package.json
```

---

## 1 — Supabase Setup

### 1.1 Create a project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy your **Project URL** and **service_role key** from:
   `Project Settings → API → Project API keys`

### 1.2 Create the `users` table

Run this SQL in the Supabase **SQL Editor**:

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- Enforce case-insensitive uniqueness
create unique index users_username_lower_idx
  on public.users (lower(username));

-- Deny direct client access — we use the service_role key from the backend only
alter table public.users enable row level security;
```

> ⚠️ **Security note:** The backend uses the `service_role` key which bypasses RLS.
> Never expose this key to the browser or client-side code.

---

## 2 — Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default `3000`) |
| `CLIENT_ORIGIN` | React dev server URL for CORS (default `http://localhost:3001`) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `JWT_SECRET` | Long random secret — generate with `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d`, `24h` (default `7d`) |

---

## 3 — Install & Run

```bash
# Install dependencies
npm install

# Development (auto-restart on change)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:3000`.

---

## 4 — API Reference

### `POST /register`

Register a new user.

**Request body:**
```json
{ "username": "cooldev42", "password": "supersecret" }
```

**Validation rules:**
- `username`: 2–24 chars, alphanumeric + `_`, `-`, `.` only
- `password`: 6–72 chars

**Success `201`:**
```json
{
  "message": "User registered successfully.",
  "user": { "id": "uuid", "username": "cooldev42" }
}
```

**Errors:** `400` (validation), `409` (username taken), `500` (server error)

---

### `POST /login`

Authenticate and receive a JWT.

**Request body:**
```json
{ "username": "cooldev42", "password": "supersecret" }
```

**Success `200`:**
```json
{
  "message": "Login successful.",
  "token": "eyJhbGci...",
  "user": { "id": "uuid", "username": "cooldev42" }
}
```

**Errors:** `400` (missing fields), `401` (wrong credentials), `500` (server error)

---

## 5 — Socket.io Authentication

Every socket connection **must** include the JWT in the handshake:

```js
// Client-side example
const socket = io("http://localhost:3000", {
  auth: { token: localStorage.getItem("descall_token") }
});
```

If the token is missing or invalid, the server rejects the connection immediately with a socket error. The `socket.user` object (`{ id, username }`) is available in all event handlers after successful authentication.

---

## 6 — Typical Auth Flow

```
Client                          Server
  │                               │
  │  POST /register               │
  │ ─────────────────────────────>│ hash password → insert into users
  │ <─────────────────────────────│ 201 { user }
  │                               │
  │  POST /login                  │
  │ ─────────────────────────────>│ fetch user → bcrypt.compare
  │ <─────────────────────────────│ 200 { token, user }
  │                               │
  │  io.connect({ auth: {token} })│
  │ ─────────────────────────────>│ socketAuthMiddleware → verifyToken
  │ <─────────────────────────────│ connection accepted → user:joined
  │                               │
```
