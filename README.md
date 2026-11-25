# ReachInbox — Email Job Scheduler

**A Full-Stack Email Scheduling and Background Job Processing System**

ReachInbox is a full-stack email scheduling application designed to compose, schedule, and process emails through a background job queue. It combines a React-based dashboard with a Node.js backend, MySQL database, Redis, and BullMQ to manage asynchronous email processing.

The project focuses on reliable job processing, transactional event handling, recipient tracking, and recovery of interrupted email jobs.

---

## Key Features

- **Google OAuth Authentication** — Sign in using your Google account.
- **Email Composition** — Create emails with a sender, subject, body, and multiple recipients.
- **Email Scheduling** — Schedule emails for future execution or process them immediately.
- **Background Job Processing** — Process email tasks asynchronously using BullMQ and Redis.
- **Transactional Outbox Pattern** — Persist email scheduling events in MySQL before dispatching jobs to the queue.
- **Idempotent Email Creation** — Use idempotency keys to prevent duplicate email creation requests.
- **Recipient Management** — Track individual recipient processing statuses.
- **Rate Limiting** — Apply sender-level and global email processing limits.
- **Lease and Recovery Mechanism** — Detect stale email jobs and recover interrupted processing.
- **Email Status Tracking** — Track queued, sending, sent, failed, and other processing states.
- **Test Email Preview** — Preview test emails through Ethereal Email.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Database | MySQL 8, Prisma ORM |
| Job Queue | BullMQ |
| Queue Storage | Redis |
| Authentication | Google OAuth, JWT |
| Email | Nodemailer, Ethereal Email |
| Infrastructure | Docker, Docker Compose |
| Validation | Zod |

## Architecture

```text
                 ┌─────────────────────┐
                 │    React Frontend   │
                 │   TypeScript + Vite │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   Express Backend   │
                 │   Google OAuth      │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │      MySQL          │
                 │   Prisma ORM        │
                 │  Email + Outbox     │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  Outbox Dispatcher  │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   Redis + BullMQ    │
                 │    Job Queue        │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   Email Worker      │
                 │  Lease + Recovery   │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │   Nodemailer        │
                 │   Ethereal SMTP     │
                 └─────────────────────┘
```

### Email Processing Workflow

1. The user authenticates through Google OAuth.
2. The user creates an email with recipients and scheduling details.
3. Email information and an outbox event are stored in a MySQL transaction.
4. The Outbox Dispatcher reads pending events and creates BullMQ jobs.
5. Redis stores and manages background jobs.
6. The Email Worker acquires a processing lease and handles recipients.
7. Rate limits and recipient statuses are checked during processing.
8. Nodemailer sends the test email through Ethereal SMTP.
9. Processing results are recorded in MySQL.

## Project Structure

```text
email-job-scheduler/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── queues/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── workers/
│   │   ├── server.ts
│   │   └── worker.ts
│   │
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

## Getting Started

### Prerequisites

Make sure you have installed:

- Node.js and npm
- Docker Desktop
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/AdnanNasim321/email-job-scheduler.git

cd email-job-scheduler
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root.

Use the provided environment example as a reference and configure your local credentials.

Required configuration includes:

- MySQL connection details
- Redis host and port
- JWT and session secrets
- Google OAuth client ID and client secret
- Frontend and backend URLs
- Worker and rate-limit settings

Never commit your actual `.env` file or credentials.

### 4. Start Infrastructure Services

```bash
docker compose up -d
```

This starts the configured database, Redis, and Elasticsearch services.

### 5. Run Database Migrations

```bash
npm exec --workspace=backend -- prisma migrate deploy
```

Ensure `DATABASE_URL` is available to the Prisma CLI before running the migration.

### 6. Start the Backend

Open a terminal:

```bash
npm run dev --workspace=backend
```

Backend URL:

`http://localhost:5000`

### 7. Start the Background Worker

Open another terminal:

```bash
npm exec --workspace=backend -- tsx src/worker.ts
```

The worker runs email processing, outbox dispatching, and stale-job recovery.

### 8. Start the Frontend

Open another terminal:

```bash
npm run dev --workspace=frontend
```

Frontend URL:

`http://localhost:5173`

### Health Check

```text
GET http://localhost:5000/api/health
```

## Email Testing

The application currently uses **Ethereal Email** with Nodemailer for SMTP testing.

Ethereal captures outgoing test messages and provides preview URLs to inspect their content.

**Note:** Ethereal is a testing service. Emails are not delivered to real recipient inboxes.

## Engineering Considerations

- **Transactional Outbox:** Keeps email creation and event persistence within the same database transaction.
- **Idempotency:** Helps prevent duplicate email creation when clients retry requests.
- **Background Processing:** Separates email execution from HTTP request handling.
- **Distributed Leases:** Helps coordinate email processing and prevent concurrent workers from taking ownership of the same active job.
- **Recovery:** Requeues eligible stale jobs after interrupted processing.
- **Rate Limiting:** Uses Redis-based atomic counters for sender and global limits.

## Future Improvements

- Integration with a production SMTP provider.
- Enhanced email analytics and reporting.
- Improved monitoring and operational dashboards.
- Additional notification integrations.
- Automated integration and load testing.

## Author

**Adnan Nasim**

- GitHub: [AdnanNasim321](https://github.com/AdnanNasim321)

---

**Built with React, Node.js, TypeScript, MySQL, Redis, and BullMQ.**
