
import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/email.queue";

const OUTBOX_POLL_INTERVAL_MS = 5000;
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const BATCH_SIZE = 50;

let dispatcherTimer: ReturnType<typeof setInterval> | null = null;
let dispatchRunning = false;

export async function dispatchPendingOutboxEvents(): Promise<void> {
  if (dispatchRunning) return;

  dispatchRunning = true;

  try {
    // Recover events abandoned by a crashed dispatcher.
    const staleCutoff = new Date(
      Date.now() - PROCESSING_TIMEOUT_MS
    );

    await prisma.outboxEvent.updateMany({
      where: {
        status: "PROCESSING",
        updatedAt: {
          lt: staleCutoff,
        },
      },
      data: {
        status: "PENDING",
      },
    });

    const events = await prisma.outboxEvent.findMany({
      where: {
        status: "PENDING",
        eventType: "EMAIL_SCHEDULE_REQUESTED",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: BATCH_SIZE,
    });

    for (const event of events) {
      try {
        // Atomically claim this event.
        const claimed = await prisma.outboxEvent.updateMany({
          where: {
            id: event.id,
            status: "PENDING",
          },
          data: {
            status: "PROCESSING",
          },
        });

        if (claimed.count !== 1) {
          continue;
        }

        const payload = event.payload;

        if (
          typeof payload !== "object" ||
          payload === null ||
          Array.isArray(payload) ||
          !("emailId" in payload) ||
          typeof payload.emailId !== "string"
        ) {
          console.error(`Invalid outbox payload: ${event.id}`);

          await prisma.outboxEvent.updateMany({
            where: {
              id: event.id,
              status: "PROCESSING",
            },
            data: {
              status: "FAILED",
            },
          });

          continue;
        }

        const emailId = payload.emailId;

        const email = await prisma.email.findUnique({
          where: {
            id: emailId,
          },
          select: {
            id: true,
            status: true,
            scheduledAt: true,
          },
        });

        if (!email) {
          console.error(`Email not found: ${emailId}`);

          await prisma.outboxEvent.updateMany({
            where: {
              id: event.id,
              status: "PROCESSING",
            },
            data: {
              status: "FAILED",
            },
          });

          continue;
        }

        if (email.status !== "QUEUED") {
          await prisma.outboxEvent.updateMany({
            where: {
              id: event.id,
              status: "PROCESSING",
            },
            data: {
              status: "PROCESSED",
              processedAt: new Date(),
            },
          });

          continue;
        }

        const delay = email.scheduledAt
          ? Math.max(
              0,
              email.scheduledAt.getTime() - Date.now()
            )
          : 0;

        // Stable ID prevents duplicate active queue jobs.
        const jobId = `email-${email.id}`;

        await emailQueue.add(
          "send-email",
          { emailId: email.id },
          {
            jobId,
            delay,
          }
        );

        await prisma.email.updateMany({
          where: {
            id: email.id,
            status: "QUEUED",
          },
          data: {
            bullJobId: jobId,
          },
        });

        const completed = await prisma.outboxEvent.updateMany({
          where: {
            id: event.id,
            status: "PROCESSING",
          },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
          },
        });

        if (completed.count !== 1) {
          throw new Error(
            `Could not finalize outbox event ${event.id}`
          );
        }

        console.log(`Outbox event processed: ${event.id}`);
      } catch (error) {
        // Keep PROCESSING. The stale-event recovery
        // will make it available for another attempt.
        console.error(
          `Outbox dispatch failed: ${event.id}`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Outbox dispatcher error:", error);
  } finally {
    dispatchRunning = false;
  }
}

export function startOutboxDispatcher(): void {
  if (dispatcherTimer) return;

  void dispatchPendingOutboxEvents();

  dispatcherTimer = setInterval(() => {
    void dispatchPendingOutboxEvents();
  }, OUTBOX_POLL_INTERVAL_MS);

  dispatcherTimer.unref();

  console.log("Outbox dispatcher started");
}

export function stopOutboxDispatcher(): void {
  if (!dispatcherTimer) return;

  clearInterval(dispatcherTimer);
  dispatcherTimer = null;
}
