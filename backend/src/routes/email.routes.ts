
import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import {
  authenticate,
  AuthRequest,
} from "../middleware/auth.middleware";
import { createScheduledEmail } from "../services/email.service";

const router = Router();

const createEmailSchema = z.object({
  senderId: z.string().min(1),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(500),
  scheduledAt: z.string().datetime().optional(),
});

// GET /api/emails/stats
router.get(
  "/stats",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const [total, sent, scheduled, failed, recentEmails] =
        await Promise.all([
          prisma.email.count({
            where: { userId },
          }),

          prisma.email.count({
            where: {
              userId,
              status: "SENT",
            },
          }),

          prisma.email.count({
            where: {
              userId,
              status: {
                in: ["QUEUED", "RATE_LIMITED"],
              },
            },
          }),

          prisma.email.count({
            where: {
              userId,
              status: "FAILED",
            },
          }),

          prisma.email.findMany({
            where: { userId },
            take: 10,
            orderBy: {
              createdAt: "desc",
            },
            select: {
              id: true,
              subject: true,
              status: true,
              createdAt: true,
              recipients: {
                select: {
                  id: true,
                  address: true,
                },
              },
            },
          }),
        ]);

      return res.status(200).json({
        success: true,
        data: {
          total,
          sent,
          scheduled,
          failed,
          recentEmails,
        },
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard statistics.",
      });
    }
  }
);

// GET /api/emails/sent
router.get(
  "/sent",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const emails = await prisma.email.findMany({
        where: {
          userId,
          status: "SENT",
        },
        include: {
          recipients: {
            select: {
              id: true,
              address: true,
              status: true,
            },
          },
        },
        orderBy: {
          sentAt: "desc",
        },
      });

      return res.status(200).json({
        success: true,
        data: emails,
      });
    } catch (error) {
      console.error("Fetch sent emails error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch sent emails.",
      });
    }
  }
);

// GET /api/emails/scheduled
router.get(
  "/scheduled",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const emails = await prisma.email.findMany({
        where: {
          userId,
          status: {
            in: ["QUEUED", "RATE_LIMITED"],
          },
          scheduledAt: {
            gt: new Date(),
          },
        },
        include: {
          recipients: {
            select: {
              id: true,
              address: true,
              status: true,
            },
          },
        },
        orderBy: {
          scheduledAt: "asc",
        },
      });

      return res.status(200).json({
        success: true,
        data: emails,
      });
    } catch (error) {
      console.error("Fetch scheduled emails error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch scheduled emails.",
      });
    }
  }
);

// POST /api/emails
router.post(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const validation = createEmailSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid email details.",
          errors: validation.error.flatten(),
        });
      }

      const idempotencyKey = req.headers["idempotency-key"];

      if (
        typeof idempotencyKey !== "string" ||
        idempotencyKey.trim().length === 0 ||
        idempotencyKey.length > 255
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid Idempotency-Key header is required.",
        });
      }

      const email = await createScheduledEmail({
        userId,
        ...validation.data,
        idempotencyKey,
        scheduledAt: validation.data.scheduledAt
          ? new Date(validation.data.scheduledAt)
          : undefined,
      });

      return res.status(201).json({
        success: true,
        message: "Email scheduled successfully.",
        data: email,
      });
    } catch (error) {
      console.error("Create email error:", error);

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to schedule email.",
      });
    }
  }
);

export default router;
