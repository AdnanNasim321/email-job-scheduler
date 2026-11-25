
import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/prisma";

const router = Router();

const createSenderSchema = z.object({
  fromAddress: z.string().trim().email(),
  displayName: z.string().trim().max(100).optional(),
  hourlyLimit: z.number().int().min(-1).default(0),
});

// Get all senders belonging to logged-in user
router.get(
  "/",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const senders = await prisma.sender.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({
        success: true,
        data: senders,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Create a sender
router.post(
  "/",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const validation = createSenderSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid sender details",
          errors: validation.error.flatten(),
        });
      }

      const sender = await prisma.sender.create({
        data: {
          userId: req.userId,
          fromAddress: validation.data.fromAddress.toLowerCase(),
          displayName: validation.data.displayName,
          hourlyLimit: validation.data.hourlyLimit,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Sender added successfully",
        data: sender,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          success: false,
          message: "This sender email already exists",
        });
      }

      return next(error);
    }
  }
);

export default router;
