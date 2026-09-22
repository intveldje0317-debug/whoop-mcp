import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveTokenDirectory } from "./token-store.js";

export const OAUTH_FLOW_LOCK_DIRECTORY = "oauth-flow.lock";

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_STALE_LOCK_MS = 5 * 60_000;

interface LockOwner {
  id: string;
  pid: number;
  hostname: string;
  createdAt: number;
}

export interface OAuthFlowLock {
  release(): Promise<void>;
}

export interface OAuthFlowLockOptions {
  pollIntervalMs?: number;
  staleLockMs?: number;
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function isLockOwner(value: unknown): value is LockOwner {
  if (typeof value !== "object" || value === null) return false;
  const owner = value as Record<string, unknown>;
  return (
    typeof owner.id === "string" &&
    typeof owner.pid === "number" &&
    typeof owner.hostname === "string" &&
    typeof owner.createdAt === "number"
  );
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return !isNodeError(error, "ESRCH");
  }
}

async function readOwner(lockDirectory: string): Promise<LockOwner | null> {
  try {
    const entries = await readdir(lockDirectory);
    const ownerFile = entries.find(
      (entry) => entry.startsWith("owner-") && entry.endsWith(".json")
    );
    if (!ownerFile) return null;
    const parsed: unknown = JSON.parse(await readFile(join(lockDirectory, ownerFile), "utf-8"));
    return isLockOwner(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function isStale(lockDirectory: string, staleLockMs: number): Promise<boolean> {
  const owner = await readOwner(lockDirectory);
  if (owner) {
    if (owner.hostname === hostname()) return !isProcessAlive(owner.pid);
    return Date.now() - owner.createdAt > staleLockMs;
  }

  try {
    const lockStat = await stat(lockDirectory);
    return Date.now() - lockStat.mtimeMs > staleLockMs;
  } catch (error: unknown) {
    return isNodeError(error, "ENOENT");
  }
}

async function quarantineStaleLock(lockDirectory: string): Promise<void> {
  const quarantinePath = `${lockDirectory}.stale-${randomUUID()}`;
  try {
    await rename(lockDirectory, quarantinePath);
  } catch (error: unknown) {
    if (isNodeError(error, "ENOENT")) return;
    throw error;
  }
  await rm(quarantinePath, { recursive: true, force: true });
}

/**
 * Acquire the cross-process lock for an interactive OAuth flow.
 *
 * Atomic directory creation elects one owner. A unique owner file makes late
 * release safe after stale-lock recovery because an old owner can only unlink
 * its own file, never a successor's.
 */
export async function acquireOAuthFlowLock(
  tokenDir?: string,
  options: OAuthFlowLockOptions = {}
): Promise<OAuthFlowLock> {
  const tokenDirectory = resolveTokenDirectory(tokenDir);
  const lockDirectory = join(tokenDirectory, OAUTH_FLOW_LOCK_DIRECTORY);
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const staleLockMs = options.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
  await mkdir(tokenDirectory, { recursive: true, mode: 0o700 });

  while (true) {
    const owner: LockOwner = {
      id: randomUUID(),
      pid: process.pid,
      hostname: hostname(),
      createdAt: Date.now(),
    };
    const ownerPath = join(lockDirectory, `owner-${owner.id}.json`);

    try {
      await mkdir(lockDirectory, { mode: 0o700 });
      try {
        await writeFile(ownerPath, JSON.stringify(owner), { encoding: "utf-8", mode: 0o600 });
      } catch (error: unknown) {
        await rmdir(lockDirectory).catch(() => undefined);
        throw error;
      }

      return {
        async release(): Promise<void> {
          try {
            await unlink(ownerPath);
          } catch (error: unknown) {
            if (!isNodeError(error, "ENOENT")) throw error;
            return;
          }
          try {
            await rmdir(lockDirectory);
          } catch (error: unknown) {
            if (!isNodeError(error, "ENOENT") && !isNodeError(error, "ENOTEMPTY")) throw error;
          }
        },
      };
    } catch (error: unknown) {
      if (!isNodeError(error, "EEXIST")) throw error;
    }

    if (await isStale(lockDirectory, staleLockMs)) {
      await quarantineStaleLock(lockDirectory);
      continue;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
