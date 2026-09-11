# Raffle App

Persian (RTL) raffle / lottery web app — **Phase 1–4**: auth, Excel upload, prizes, live draw, and public landing.

## Stack

- Vite + React (JavaScript)
- React Router
- Tailwind CSS + Vazirmatn
- Netlify Functions + Netlify Blobs
- SheetJS (`xlsx`) for Excel parsing
- JWT sessions (`jsonwebtoken` + `bcryptjs`)

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root (Netlify Dev loads it automatically):

```bash
cp .env.example .env
```

3. Set environment variables (see below). Generate a bcrypt hash for your password:

```bash
node -e "import('bcryptjs').then(b => b.hash('YOUR_PASSWORD', 10).then(console.log))"
```

4. Run with Netlify Dev (frontend + functions + local Blobs):

```bash
npm run dev:netlify
```

Open the printed URL (usually `http://localhost:8888`).

- Login: `/login`
- Admin (raffle list): `/admin`
- New raffle upload: `/admin/raffles/new`
- Prize configuration: `/admin/raffles/:raffleId`
- Admin draw control: `/admin/raffles/:raffleId/draw`
- **Public live landing:** `/live/:raffleId` — cinematic countdown → slot machine → confetti reveal (`DrawReveal`)

## Environment variables

| Variable | Description |
| --- | --- |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password |
| `JWT_SECRET` | Secret used to sign/verify session JWTs (use a long random string) |

## Phase scope

**Phase 1** — auth + Excel upload → draft raffle

**Phase 2** — prize configuration → status `ready`

**Phase 3** — admin live draw control

**Phase 4** — public landing `/live/:raffleId`

- Ceremony UI for the audience (RTL, full-screen)
- Polls every 2s so spectators see new winners
- If the admin is logged in on that same URL, the draw button appears and the lottery runs there
- Guests cannot draw; they only watch
- Public API hides full participant lists; winner phones are masked

## API

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/login` | POST | — | `{ email, password }` → `{ token, email }` |
| `/api/verify-session` | GET | Bearer JWT | Validate session |
| `/api/upload-participants` | POST | Bearer JWT | `{ name, rows }` → creates draft raffle |
| `/api/list-raffles` | GET | Bearer JWT | Index of raffles |
| `/api/get-raffle?id=` | GET | Bearer JWT | Full admin raffle summary |
| `/api/get-public-raffle?id=` | GET | — | Safe public payload for the live page |
| `/api/save-prizes` | POST | Bearer JWT | Save prizes |
| `/api/draw-winner` | POST | Bearer JWT | Draw next winner |
| `/api/delete-raffle` | POST | Bearer JWT | `{ raffleId }` → delete raffle + index entry |

Raffles are stored at Blob keys `raffles/{raffleId}.json`, with an index at `raffles/index.json`.
