
import { Router, Request, Response, NextFunction } from "express";
import passport from "../config/passport";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import {
  authenticate,
  AuthRequest,
} from "../middleware/auth.middleware";
import { prisma } from "../config/prisma";

const router = Router();

const clearOAuthSessionCookie = (res: Response) => {
  res.clearCookie("oauth_session", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
};

// Google OAuth Login
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// Google OAuth Callback
router.get(
  "/google/callback",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      "google",
      { session: false },
      (error: Error | null, user: { id: string } | false) => {
        if (error || !user) {
          return req.session.destroy((sessionError) => {
            if (sessionError) {
              console.error("OAuth session cleanup error:", sessionError);
            }

            clearOAuthSessionCookie(res);

            return res.redirect(
              `${env.FRONTEND_URL}/login?error=google_auth_failed`
            );
          });
        }

        const token = jwt.sign(
          { userId: user.id },
          env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        return req.session.destroy((sessionError) => {
          if (sessionError) {
            return next(sessionError);
          }

          clearOAuthSessionCookie(res);

          res.cookie("token", token, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: "/",
          });

          return res.redirect(`${env.FRONTEND_URL}/dashboard`);
        });
      }
    )(req, res, next);
  }
);

// Get Authenticated User
router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Logout
router.post(
  "/logout",
  (_req: Request, res: Response) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
);

export default router;
