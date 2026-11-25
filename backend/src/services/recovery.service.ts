
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { hasActiveLease } from "./lease.service";

let recoveryTimer: ReturnType<typeof setInterval> | null = null;
let recoveryRunning = false;

export async function recoverStaleEmails(): Promise<void> {
  if (recoveryRunning) return;

  recoveryRunning = true;

  try {
    const cutoff = new Date(Date.now() - env.RECOVERY_TIMEOUT_MS);

    const staleEmails = await prisma.email.findMany({
      where: {
        status: "SENDING",
        sendingAt: { lt: cutoff },
      },
      select: {
        id: true,
        sendingAt: true,
        leaseToken: true,
      },
      take: 100,
      orderBy: { sendingAt: "asc" },
    });

    for (const email of staleEmails) {
      try {
        // Never recover an email with an active Redis lease.
        const activeLease = await hasActiveLease(email.id);

        if (activeLease) continue;

        // Atomically recover the email and create an outbox event.
        const recovered = await prisma.$transaction(async (tx) => {
          const result = await tx.email.updateMany({
            where: {
              id: email.id,
              status: "SENDING",
              sendingAt: email.sendingAt,
              leaseToken: email.leaseToken,
            },
            data: {
              status: "QUEUED",
              sendingAt: null,
              leaseToken: null,
              bullJobId: null,
            },
          });

          // Another recovery process may have already handled it.
          if (result.count !== 1) return false;

          // Reset recipients that were interrupted while sending.
          await tx.recipient.updateMany({
            where: {
              emailId: email.id,
              status: "SENDING",
            },
            data: {
              status: "PENDING",
            },
          });

          // Outbox dispatcher will enqueue this email.
          await tx.outboxEvent.create({
            data: {
              eventType: "EMAIL_SCHEDULE_REQUESTED",
              payload: {
                emailId: email.id,
              },
              status: "PENDING",
            },
          });

          return true;
        });

        if (recovered) {
          console.log(`Recovered stale email: ${email.id}`);
        }
      } catch (error) {
        console.error(
          `Recovery failed for email ${email.id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Stale email recovery cycle failed:", error);
  } finally {
    recoveryRunning = false;
  }
}

export function startRecoveryService(): void {
  if (recoveryTimer) return;

  void recoverStaleEmails();

  recoveryTimer = setInterval(() => {
    void recoverStaleEmails();
  }, env.RECOVERY_POLL_MS);

  recoveryTimer.unref();

  console.log("Email recovery service started");
}

export function stopRecoveryService(): void {
  if (!recoveryTimer) return;

  clearInterval(recoveryTimer);
  recoveryTimer = null;

  console.log("Email recovery service stopped");
}
