# ReachInbox – Email Job Scheduler

A full-stack email scheduling application that allows users to compose, schedule, and manage emails through a simple dashboard. The application uses background job processing to handle scheduled emails efficiently.

## Features

- **Google Authentication:** Secure login using Google OAuth.
- **Email Composition:** Create emails with subject, body, sender, and multiple recipients.
- **Email Scheduling:** Send emails immediately or schedule them for later.
- **Background Processing:** BullMQ and Redis handle asynchronous email jobs.
- **Transactional Outbox:** Stores email scheduling events reliably before queue dispatch.
- **Retry Handling:** Supports retrying failed email processing.
- **Email Tracking:** View email status such as queued, sending, sent, and failed.
- **Rate Limiting:** Controls email processing limits.
- **Dashboard:** Manage and monitor scheduled and sent emails.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Database | MySQL, Prisma ORM |
| Queue | BullMQ, Redis |
| Authentication | Google OAuth, JWT |
| Email Testing | Nodemailer, Ethereal Email |
| Infrastructure | Docker, Docker Compose |

## Project Structure

```text
email-job-scheduler/
├── backend/
│   ├── prisma/
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── queues/
│       ├── workers/
│       ├── server.ts
│       └── worker.ts
├── frontend/
│   └── src/
├── docker-compose.yml
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js
- npm
- Docker Desktop
- Git

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/email-job-scheduler.git
cd email-job-scheduler
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

Configure the following variables:

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

DATABASE_URL=mysql://scheduler_user:YOUR_PASSWORD@localhost:3307/email_scheduler

REDIS_HOST=localhost
REDIS_PORT=6379

ELASTICSEARCH_URL=http://localhost:9200

JWT_SECRET=your_jwt_secret_at_least_32_characters
SESSION_SECRET=your_session_secret_at_least_32_characters

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

SENDER_RATE_LIMIT_PER_HOUR=50
GLOBAL_RATE_LIMIT_PER_HOUR=500
WORKER_CONCURRENCY=3
```

Never commit your actual `.env` file or credentials.

### 4. Start infrastructure

```bash
docker compose up -d
```

### 5. Run database migrations

```bash
npm exec --workspace=backend -- prisma migrate deploy
```

### 6. Start the backend

```bash
npm run dev --workspace=backend
```

### 7. Start the worker

Open another terminal:

```bash
npm exec --workspace=backend -- tsx src/worker.ts
```

### 8. Start the frontend

Open another terminal:

```bash
npm run dev --workspace=frontend
```

Open the frontend at:

http://localhost:5173

Backend health endpoint:

http://localhost:5000/api/health

## Email Testing

This project uses Ethereal Email for SMTP testing through Nodemailer.

Ethereal captures test emails and provides preview links. Emails are not delivered to real recipient inboxes.

## Architecture Overview

1. Users authenticate using Google OAuth.
2. Users compose an email and choose recipients.
3. Email data and an outbox event are stored in MySQL using a database transaction.
4. The Outbox Dispatcher processes pending events and adds jobs to BullMQ.
5. Redis manages the background job queue.
6. The email worker processes jobs and sends test emails through Ethereal SMTP.
7. Email and recipient statuses are updated in the database.

## Future Improvements

- Real SMTP provider integration.
- Advanced email analytics.
- Improved scheduling and monitoring.
- Additional notification integrations.

## Author

**Adnan Nasim**

GitHub: https://github.com/Adnannasim321

---

*Built as a full-stack email scheduling project.*