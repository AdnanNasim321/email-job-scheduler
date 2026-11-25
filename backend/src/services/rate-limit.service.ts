
import { redis } from "../config/redis";
import { env } from "../config/env";

const RATE_LIMIT_SCRIPT = `
  local senderLimit = tonumber(ARGV[1])
  local globalLimit = tonumber(ARGV[2])
  local windowSeconds = tonumber(ARGV[3])

  local senderCount = 0
  local globalCount = 0

  if senderLimit > 0 then
    senderCount = tonumber(redis.call("GET", KEYS[1]) or "0")
  end

  if globalLimit > 0 then
    globalCount = tonumber(redis.call("GET", KEYS[2]) or "0")
  end

  if senderLimit > 0 and senderCount >= senderLimit then
    return {0, senderCount, globalCount, redis.call("TTL", KEYS[1])}
  end

  if globalLimit > 0 and globalCount >= globalLimit then
    return {0, senderCount, globalCount, redis.call("TTL", KEYS[2])}
  end

  if senderLimit > 0 then
    senderCount = redis.call("INCR", KEYS[1])
    if senderCount == 1 then
      redis.call("EXPIRE", KEYS[1], windowSeconds)
    end
  end

  if globalLimit > 0 then
    globalCount = redis.call("INCR", KEYS[2])
    if globalCount == 1 then
      redis.call("EXPIRE", KEYS[2], windowSeconds)
    end
  end

  return {1, senderCount, globalCount, 0}
`;

export interface RateLimitResult {
  allowed: boolean;
  senderCount: number;
  globalCount: number;
  retryAfterMs: number;
  reason: "NONE" | "SENDER_LIMIT" | "GLOBAL_LIMIT";
}

export async function consumeRecipientQuota(
  senderId: string,
  senderHourlyLimit: number
): Promise<RateLimitResult> {
  const senderLimit =
    senderHourlyLimit === 0
      ? env.SENDER_RATE_LIMIT_PER_HOUR
      : senderHourlyLimit;

  const globalLimit = env.GLOBAL_RATE_LIMIT_PER_HOUR;

  if (senderLimit < -1) {
    throw new Error("Invalid sender hourly limit");
  }

  const windowId = Math.floor(Date.now() / 3_600_000);
  const windowSeconds = 3600;

  const senderKey = `rate:sender:${senderId}:${windowId}`;
  const globalKey = `rate:global:${windowId}`;

  const result = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    2,
    senderKey,
    globalKey,
    String(senderLimit),
    String(globalLimit),
    String(windowSeconds)
  )) as [number, number, number, number];

  const [allowed, senderCount, globalCount, retrySeconds] = result;

  let reason: RateLimitResult["reason"] = "NONE";

  if (allowed === 0) {
    if (
      senderLimit > 0 &&
      senderCount >= senderLimit
    ) {
      reason = "SENDER_LIMIT";
    } else {
      reason = "GLOBAL_LIMIT";
    }
  }

  return {
    allowed: allowed === 1,
    senderCount,
    globalCount,
    retryAfterMs: Math.max(0, retrySeconds) * 1000,
    reason,
  };
}
