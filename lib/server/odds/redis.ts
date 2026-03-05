import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

export function hasRedisConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis(): Redis | null {
  if (!hasRedisConfig()) return null;
  if (redisClient) return redisClient;

  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  });
  return redisClient;
}

export function cacheProviderName(): "redis" | "memory" {
  return hasRedisConfig() ? "redis" : "memory";
}
