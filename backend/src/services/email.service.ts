
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

interface CreateEmailInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduledAt?: Date;
  idempotencyKey: string;
}

export async function createScheduledEmail(
  input: CreateEmailInput
) {
  const {
    userId,
    senderId,
    subject,
    body,
    recipients,
    scheduledAt,
    idempotencyKey,
  } = input;

  if (!idempotencyKey?.trim() || idempotencyKey.length > 255) {
    throw new Error("A valid idempotency key is required");
  }

  const normalizedRecipients = [
    ...new Set(
      recipients
        .map((address) => address.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  if (!normalizedRecipients.length) {
    throw new Error("At least one recipient is required");
  }

  if (normalizedRecipients.length > 500) {
    throw new Error("Maximum 500 recipients are allowed");
  }

  if (!subject.trim() || !body.trim()) {
    throw new Error("Subject and body are required");
  }

  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid scheduled date");
  }

  if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
    throw new Error("Scheduled time must be in the future");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Return existing email for a repeated request.
      const existingEmail = await tx.email.findUnique({
        where: {
          idempotencyKey,
        },
        include: {
          recipients: true,
          sender: true,
        },
      });

      if (existingEmail) {
        if (existingEmail.userId !== userId) {
          throw new Error("Idempotency key conflict");
        }

        return existingEmail;
      }

      const sender = await tx.sender.findFirst({
        where: {
          id: senderId,
          userId,
        },
      });

      if (!sender) {
        throw new Error("Sender not found");
      }

      const email = await tx.email.create({
        data: {
          userId,
          senderId,
          subject: subject.trim(),
          body: body.trim(),
          status: "QUEUED",
          scheduledAt: scheduledAt ?? null,
          idempotencyKey,

          recipients: {
            create: normalizedRecipients.map((address) => ({
              address,
              status: "PENDING",
            })),
          },
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: "EMAIL_SCHEDULE_REQUESTED",
          payload: {
            emailId: email.id,
          },
          status: "PENDING",
        },
      });

      return tx.email.findUniqueOrThrow({
        where: {
          id: email.id,
        },
        include: {
          recipients: true,
          sender: true,
        },
      });
    });
  } catch (error) {
    // Handle concurrent requests using the same unique key.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingEmail = await prisma.email.findUnique({
        where: {
          idempotencyKey,
        },
        include: {
          recipients: true,
          sender: true,
        },
      });

      if (existingEmail && existingEmail.userId === userId) {
        return existingEmail;
      }
    }

    throw error;
  }
}
