
import { emailWorker } from "./workers/email.worker";

import {
  startRecoveryService,
  stopRecoveryService,
} from "./services/recovery.service";

import {
  startOutboxDispatcher,
  stopOutboxDispatcher,
} from "./services/outbox.service";

import { emailQueue } from "./queues/email.queue";
import { redis } from "./config/redis";
import { prisma } from "./config/prisma";

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`Worker received ${signal}. Shutting down...`);

  try {
    stopRecoveryService();
    stopOutboxDispatcher();

    await emailWorker.close();
    await emailQueue.close();

    await redis.quit();
    await prisma.$disconnect();

    console.log("Worker shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Worker shutdown error:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function startWorker(): Promise<void> {
  try {
    await redis.ping();
    await prisma.$connect();

    startRecoveryService();
    startOutboxDispatcher();

    console.log("Email worker process started");
    console.log("Recovery service initialized");
    console.log("Outbox dispatcher initialized");
  } catch (error) {
    console.error("Worker startup failed:", error);
    process.exit(1);
  }
}

void startWorker();
