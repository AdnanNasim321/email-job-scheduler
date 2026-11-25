
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";

import { env } from "./config/env";
import passport from "./config/passport";
import { authenticate } from "./middleware/auth.middleware";

import authRoutes from "./routes/auth.routes";
import emailRoutes from "./routes/email.routes";
import senderRoutes from "./routes/sender.routes";

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Request parsers
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// OAuth session configuration
app.use(
  session({
    name: "oauth_session",
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    },
  })
);

// Initialize Passport
app.use(passport.initialize());

// Public health endpoint
app.get("/api/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Email Job Scheduler API is running",
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Protect application API routes
app.use("/api", authenticate);

// Protected application routes
app.use("/api/emails", emailRoutes);
app.use("/api/senders", senderRoutes);

// Start server
app.listen(env.PORT, () => {
  console.log(`Backend running at http://localhost:${env.PORT}`);
});
