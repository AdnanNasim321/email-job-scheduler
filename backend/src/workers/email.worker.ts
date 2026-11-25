
import { Worker } from "bullmq";
import { randomUUID } from "crypto";

import { EMAIL_QUEUE, emailQueue } from "../queues/email.queue";
import { redis } from "../config/redis";
import { prisma } from "../config/prisma";
import { sendTestEmail } from "../config/mailer";
import { env } from "../config/env";

import {
  acquireLease,
  releaseLease,
} from "../services/lease.service";

import {
  startLeaseHeartbeat,
} from "../services/heartbeat.service";

import {
  claimEmailForSending,
  assertEmailLease,
} from "../services/fencing.service";

import {
  consumeRecipientQuota,
} from "../services/rate-limit.service";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueueEmail(
  emailId: string,
  delay: number,
  status: "QUEUED" | "RATE_LIMITED"
): Promise<string> {
  const newJobId = `email-${emailId}-${randomUUID()}`;

  await prisma.email.updateMany({
    where: {
      id: emailId,
      status: "SENDING",
    },
    data: {
      status,
      sendingAt: null,
      leaseToken: null,
    },
  });

  await emailQueue.add(
    "send-email",
    { emailId },
    {
      jobId: newJobId,
      delay: Math.max(0, delay),
    }
  );

  await prisma.email.updateMany({
    where: {
      id: emailId,
      status,
    },
    data: {
      bullJobId: newJobId,
    },
  });

  return newJobId;
}

export const emailWorker = new Worker(
  EMAIL_QUEUE,
  async (job) => {
    const { emailId } = job.data as { emailId: string };

    const leaseToken = await acquireLease(emailId);

    if (!leaseToken) {
      console.log(`Email ${emailId} is already being processed`);
      return { skipped: true, reason: "LEASE_UNAVAILABLE" };
    }

    const heartbeat = startLeaseHeartbeat(
      emailId,
      leaseToken,
      () => {
        console.error(`Lease lost for email ${emailId}`);
      }
    );

    try {
      const claimed = await claimEmailForSending(
        emailId,
        leaseToken
      );

      if (!claimed) {
        return { skipped: true, reason: "EMAIL_NOT_CLAIMED" };
      }

      const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: {
          sender: true,
          recipients: true,
        },
      });

      if (!email) {
        throw new Error(`Email ${emailId} not found`);
      }

      const pendingRecipients = email.recipients.filter(
        (recipient) => recipient.status === "PENDING"
      );

      let rateLimited = false;
      let rateLimitDelay = 0;
      let retryPending = false;

      for (const recipient of pendingRecipients) {
        await assertEmailLease(emailId, leaseToken);

        if (!heartbeat.isLeaseValid()) {
          throw new Error(`Lease lost for email ${emailId}`);
        }

        const quota = await consumeRecipientQuota(
          email.senderId,
          email.sender.hourlyLimit
        );

        if (!quota.allowed) {
          rateLimited = true;
          rateLimitDelay = quota.retryAfterMs;
          console.log(
            `Rate limit reached for ${email.sender.fromAddress}: ${quota.reason}`
          );
          break;
        }

        const claimedRecipient = await prisma.recipient.updateMany({
          where: {
            id: recipient.id,
            emailId,
            status: "PENDING",
            email: {
              is: {
                id: emailId,
                status: "SENDING",
                leaseToken,
              },
            },
          },
          data: {
            status: "SENDING",
          },
        });

        if (claimedRecipient.count !== 1) {
          throw new Error(
            `Could not claim recipient ${recipient.id}`
          );
        }

        try {
          await assertEmailLease(emailId, leaseToken);

          const result = await sendTestEmail(
            recipient.address,
            email.subject,
            email.body
          );

          await assertEmailLease(emailId, leaseToken);

          const updated = await prisma.recipient.updateMany({
            where: {
              id: recipient.id,
              emailId,
              status: "SENDING",
              email: {
                is: {
                  id: emailId,
                  status: "SENDING",
                  leaseToken,
                },
              },
            },
            data: {
              status: "SENT",
              sentAt: new Date(),
              failedAt: null,
              failReason: null,
            },
          });

          if (updated.count !== 1) {
            throw new Error(
              `Recipient update rejected by fencing: ${recipient.id}`
            );
          }

          console.log("Test email sent:", recipient.address);
          console.log("Ethereal preview:", result.previewUrl);
        } catch (error) {
          // Do not write recipient results after losing the lease.
          await assertEmailLease(emailId, leaseToken);

          const message =
            error instanceof Error
              ? error.message
              : "Unknown email delivery error";

          const nextRetryCount = recipient.retryCount + 1;
          const canRetry =
            nextRetryCount <= env.MAX_RECIPIENT_RETRIES;

          const updated = await prisma.recipient.updateMany({
            where: {
              id: recipient.id,
              emailId,
              status: "SENDING",
              email: {
                is: {
                  id: emailId,
                  status: "SENDING",
                  leaseToken,
                },
              },
            },
            data: {
              status: canRetry ? "PENDING" : "FAILED",
              retryCount: { increment: 1 },
              failReason: message,
              failedAt: canRetry ? null : new Date(),
            },
          });

          if (updated.count !== 1) {
            throw new Error(
              `Could not save recipient failure: ${recipient.id}`
            );
          }

          if (canRetry) {
            retryPending = true;
          }

          console.error(
            "Email delivery failed:",
            recipient.address,
            message
          );
        }

        if (env.MIN_SEND_DELAY_MS > 0) {
          await sleep(env.MIN_SEND_DELAY_MS);
        }
      }

      await assertEmailLease(emailId, leaseToken);

      const updatedRecipients = await prisma.recipient.findMany({
        where: { emailId },
      });

      const sent = updatedRecipients.filter(
        (recipient) => recipient.status === "SENT"
      ).length;

      const failed = updatedRecipients.filter(
        (recipient) => recipient.status === "FAILED"
      ).length;

      const pending = updatedRecipients.filter(
        (recipient) =>
          recipient.status === "PENDING" ||
          recipient.status === "SENDING"
      );

      if (rateLimited) {
        const jitter = Math.floor(Math.random() * 5000);

        await enqueueEmail(
          emailId,
          rateLimitDelay + jitter,
          "RATE_LIMITED"
        );
      } else if (pending.length > 0 || retryPending) {
        const highestRetry = Math.max(
          1,
          ...pending.map((recipient) => recipient.retryCount)
        );

        const retryDelay = Math.min(
          300000,
          5000 * Math.pow(2, highestRetry - 1)
        );

        await enqueueEmail(
          emailId,
          retryDelay,
          "QUEUED"
        );
      } else {
        const finalStatus =
          failed === 0
            ? "SENT"
            : sent > 0
              ? "PARTIAL"
              : "FAILED";

        const finalized = await prisma.email.updateMany({
          where: {
            id: emailId,
            status: "SENDING",
            leaseToken,
          },
          data: {
            status: finalStatus,
            sentAt: sent > 0 ? new Date() : null,
            failedAt: failed > 0 ? new Date() : null,
            failReason:
              failed > 0
                ? `${failed} recipient(s) failed`
                : null,
            sendingAt: null,
            leaseToken: null,
          },
        });

        if (finalized.count !== 1) {
          throw new Error(
            `Could not finalize email ${emailId}: lease lost`
          );
        }
      }

      return {
        emailId,
        total: updatedRecipients.length,
        sent,
        failed,
        pending: pending.length,
        rateLimited,
      };
    } finally {
      heartbeat.stop();
      await releaseLease(emailId, leaseToken);
    }
  },
  {
    connection: redis,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on("completed", (job, result) => {
  console.log(`Email job ${job.id} completed`, result);
});

emailWorker.on("failed", (job, error) => {
  console.error(
    `Email job ${job?.id} failed:`,
    error.message
  );
});

emailWorker.on("error", (error) => {
  console.error("Email worker error:", error);
});
