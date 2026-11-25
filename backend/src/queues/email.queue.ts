import { Queue } from "bullmq";
import { redis } from "../config/redis";

export const EMAIL_QUEUE = "email-scheduler";

export const emailQueue = new Queue(EMAIL_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: {
      age: 86400,
      count: 1000
    },
    removeOnFail: {
      age: 604800
    }
  }
});