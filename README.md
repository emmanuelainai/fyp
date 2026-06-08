# ExamSentinel

ExamSentinel is a full-stack online exam monitoring MVP. It supports student authentication, consent-led permission requests, browser and webcam presence monitoring, real-time event logging, rule-based risk scoring, examiner dashboards, evidence uploads, alerts, and post-exam reports.

## Features

- JWT authentication with `STUDENT`, `EXAMINER`, and `ADMIN` roles.
- Student account creation requires a 6-digit email verification code before the account is created.
- Forgot-password reset sends a 6-digit email code before accepting a new password.
- Students can view assigned exams, accept monitoring consent, grant camera/fullscreen permissions, take an exam, and submit.
- Monitoring events include webcam presence signal, tab switching, fullscreen exit/enter, window blur/focus, copy/paste attempts, right-click attempts, screenshots/webcam frame evidence, and system warnings.
- Backend stores sessions, events, risk scores, alerts, evidence, and reports in PostgreSQL through Prisma.
- Socket.io pushes live session, risk, alert, event, and evidence updates to examiner dashboards.
- Rule-based risk scoring caps at 100 and maps to `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL`.
- Local evidence storage under `uploads/evidence` for development.
- Placeholder `AIService` is ready for future FastAPI/MediaPipe integration without breaking the MVP.

## Privacy And Consent

ExamSentinel does not start monitoring secretly. Before a student starts an exam, the app shows a consent screen explaining that:

- Webcam access may be required.
- Browser activity such as tab switching, fullscreen exit, copy/paste attempts, focus changes, and visibility changes will be logged.
- Evidence frames may be captured only during the active exam session.
- Monitoring data is used only for academic integrity review.
- The student can cancel if they do not agree.

The browser APIs used are standard APIs: `navigator.mediaDevices.getUserMedia({ video: true, audio: false })`, `requestFullscreen()`, `document.visibilitychange`, `window.blur/focus`, and page-scoped clipboard events. The app does not read clipboard contents, store raw video streams, monitor outside the exam page, or bypass browser/OS permissions.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Socket.io Client.
- Backend: Node.js, Express, TypeScript, Socket.io, PostgreSQL, Prisma, JWT, bcrypt, Multer, Zod, Helmet, CORS, express-rate-limit.
- Tests: Vitest.
- Development database: PostgreSQL via Docker Compose.

## Project Structure

```text
client/   React frontend
server/   Express API, Prisma schema, sockets, services, tests
docker/   Docker Compose database file
```

## Configuration

Copy the example environment into the server and client folders as needed:

```bash
cp .env.example server/.env
cp .env.example client/.env
```

For local Docker PostgreSQL, use this `DATABASE_URL` in `server/.env`:

```bash
DATABASE_URL=postgresql://examsentinel:examsentinel@localhost:5432/examsentinel
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@examsentinel.local
```

When SMTP is not configured, email messages are logged by the backend and local development responses include a `devCode` so you can complete account verification and password reset flows. Configure the SMTP variables to send real emails.

## Install And Run

Start PostgreSQL:

```bash
docker compose up -d
```

Backend:

```bash
cd server
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Frontend:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

Seed users:

- Admin: `admin@examsentinel.com` / `Admin123!`
- Examiner: `examiner@examsentinel.com` / `Examiner123!`
- Student: `student@examsentinel.com` / `Student123!`

## API Overview

- Auth: `POST /api/auth/register`, `POST /api/auth/register/verify`, `POST /api/auth/login`, `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`, `GET /api/auth/me`, `POST /api/auth/logout`
- Users: `GET /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id`, `DELETE /api/users/:id`
- Exams: `POST /api/exams`, `GET /api/exams`, `GET /api/exams/:id`, `PATCH /api/exams/:id`, `DELETE /api/exams/:id`, `POST /api/exams/:id/assign`
- Sessions: `POST /api/sessions/start`, `POST /api/sessions/:id/end`, `GET /api/sessions`, `GET /api/sessions/:id`
- Monitoring: `POST /api/sessions/:id/events`, `GET /api/sessions/:id/events`, `POST /api/sessions/:id/evidence`, `GET /api/sessions/:id/evidence`
- Alerts: `GET /api/alerts`, `GET /api/alerts/:id`, `PATCH /api/alerts/:id/resolve`
- Reports: `GET /api/reports`, `POST /api/sessions/:id/report/generate`, `GET /api/sessions/:id/report`
- Dashboard: `GET /api/dashboard/overview`, `GET /api/dashboard/exam/:examId`

## WebSocket Events

Clients authenticate Socket.io connections with the same JWT. Rooms include `session:{sessionId}`, `exam:{examId}`, and `examiner:{userId}`.

Student/client events:

- `session:join`
- `exam:join`
- `session:heartbeat`

Server dashboard events:

- `session:started`
- `session:updated`
- `session:ended`
- `event:new`
- `alert:new`
- `alert:resolved`
- `risk:updated`
- `evidence:new`

## Tests And Checks

Backend tests:

```bash
cd server
npm test
```

Build checks:

```bash
cd server && npm run build
cd ../client && npm run build
```

## Known Limitations

- Webcam monitoring is an MVP browser-side presence signal, not a production-grade face recognition system.
- PDF export is not implemented; reports are stored as structured JSON and rendered in the UI.
- Evidence is stored locally for development. Use S3-compatible storage for production.
- The optional AI service is a placeholder and is disabled by default.
