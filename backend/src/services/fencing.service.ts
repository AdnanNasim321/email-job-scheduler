
import { prisma } from "../config/prisma";
import { verifyLease } from "./lease.service";

export async function claimEmailForSending(
  emailId: string,
  leaseToken: string
): Promise<boolean> {
  // Confirm Redis lease ownership first.
  const ownsLease = await verifyLease(emailId, leaseToken);

  if (!ownsLease) {
    return false;
  }

  // Atomically claim only emails that are ready to send.
  const result = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: {
        in: ["QUEUED", "RATE_LIMITED"],
      },
    },
    data: {
      status: "SENDING",
      sendingAt: new Date(),
      leaseToken,
    },
  });

  return result.count === 1;
}

export async function assertEmailLease(
  emailId: string,
  leaseToken: string
): Promise<void> {
  const ownsRedisLease = await verifyLease(emailId, leaseToken);

  if (!ownsRedisLease) {
    throw new Error(`Redis lease lost for email ${emailId}`);
  }

  const email = await prisma.email.findFirst({
    where: {
      id: emailId,
      leaseToken,
      status: "SENDING",
    },
    select: {
      id: true,
    },
  });

  if (!email) {
    throw new Error(`Database lease lost for email ${emailId}`);
  }
}
