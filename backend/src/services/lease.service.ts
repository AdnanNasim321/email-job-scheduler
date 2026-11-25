
import { randomUUID } from "crypto";
import { redis } from "../config/redis";
import { env } from "../config/env";

const LEASE_KEY_PREFIX = "email:lease:";

// Only the owner of a lease can renew it.
const HEARTBEAT_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
  end
  return 0
`;

// Only the owner of a lease can release it.
const RELEASE_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

// Verify that the supplied token still owns the lease.
const VERIFY_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return 1
  end
  return 0
`;

function getLeaseKey(emailId: string): string {
  return `${LEASE_KEY_PREFIX}${emailId}`;
}

export async function acquireLease(
  emailId: string
): Promise<string | null> {
  const token = randomUUID();

  const result = await redis.set(
    getLeaseKey(emailId),
    token,
    "PX",
    env.LEASE_TTL_MS,
    "NX"
  );

  return result === "OK" ? token : null;
}

export async function heartbeatLease(
  emailId: string,
  token: string
): Promise<boolean> {
  const result = await redis.eval(
    HEARTBEAT_SCRIPT,
    1,
    getLeaseKey(emailId),
    token,
    String(env.LEASE_TTL_MS)
  );

  return result === 1;
}

export async function releaseLease(
  emailId: string,
  token: string
): Promise<boolean> {
  const result = await redis.eval(
    RELEASE_SCRIPT,
    1,
    getLeaseKey(emailId),
    token
  );

  return result === 1;
}

export async function verifyLease(
  emailId: string,
  token: string
): Promise<boolean> {
  const result = await redis.eval(
    VERIFY_SCRIPT,
    1,
    getLeaseKey(emailId),
    token
  );

  return result === 1;
}
export async function hasActiveLease(
  emailId: string
): Promise<boolean> {
  const exists = await redis.exists(getLeaseKey(emailId));
  return exists === 1;
}