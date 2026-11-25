
import { heartbeatLease } from "./lease.service";
import { env } from "../config/env";

interface HeartbeatManager {
  stop: () => void;
  isLeaseValid: () => boolean;
}

export function startLeaseHeartbeat(
  emailId: string,
  token: string,
  onLeaseLost?: () => void
): HeartbeatManager {
  let leaseValid = true;
  let stopped = false;
  let heartbeatInProgress = false;

  const timer = setInterval(async () => {
    if (stopped || heartbeatInProgress || !leaseValid) {
      return;
    }

    heartbeatInProgress = true;

    try {
      const renewed = await heartbeatLease(emailId, token);

      if (!renewed) {
        leaseValid = false;
        clearInterval(timer);
        onLeaseLost?.();
      }
    } catch (error) {
      leaseValid = false;
      clearInterval(timer);

      console.error(
        `Heartbeat failed for email ${emailId}:`,
        error
      );

      onLeaseLost?.();
    } finally {
      heartbeatInProgress = false;
    }
  }, env.HEARTBEAT_INTERVAL_MS);

  timer.unref();

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },

    isLeaseValid: () => leaseValid && !stopped
  };
}
