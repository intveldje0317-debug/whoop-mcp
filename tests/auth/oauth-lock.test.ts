import { mkdtemp, mkdir, rename, stat, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireOAuthFlowLock, OAUTH_FLOW_LOCK_DIRECTORY } from "../../src/auth/oauth-lock.js";

const temporaryDirectories: string[] = [];

async function createTokenDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "whoop-oauth-lock-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("OAuth flow lock", () => {
  it("serializes concurrent owners for the same token directory", async () => {
    const tokenDirectory = await createTokenDirectory();
    const first = await acquireOAuthFlowLock(tokenDirectory, { pollIntervalMs: 5 });
    let secondAcquired = false;
    const secondPromise = acquireOAuthFlowLock(tokenDirectory, { pollIntervalMs: 5 }).then(
      (lock) => {
        secondAcquired = true;
        return lock;
      }
    );

    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(secondAcquired).toBe(false);

    await first.release();
    const second = await secondPromise;
    expect(secondAcquired).toBe(true);
    await second.release();
  });

  it("recovers a lock owned by a dead local process", async () => {
    const tokenDirectory = await createTokenDirectory();
    const lockDirectory = join(tokenDirectory, OAUTH_FLOW_LOCK_DIRECTORY);
    await mkdir(lockDirectory);
    await writeFile(
      join(lockDirectory, "owner-dead.json"),
      JSON.stringify({
        id: "dead",
        pid: 2_147_483_647,
        hostname: hostname(),
        createdAt: Date.now() - 60_000,
      })
    );

    const lock = await acquireOAuthFlowLock(tokenDirectory, { pollIntervalMs: 5 });
    await expect(stat(lockDirectory)).resolves.toBeDefined();
    await lock.release();
  });

  it("recovers expired ownership from another host", async () => {
    const tokenDirectory = await createTokenDirectory();
    const lockDirectory = join(tokenDirectory, OAUTH_FLOW_LOCK_DIRECTORY);
    await mkdir(lockDirectory);
    await writeFile(
      join(lockDirectory, "owner-remote.json"),
      JSON.stringify({
        id: "remote",
        pid: 123,
        hostname: "another-host",
        createdAt: Date.now() - 1_000,
      })
    );

    const lock = await acquireOAuthFlowLock(tokenDirectory, {
      pollIntervalMs: 5,
      staleLockMs: 100,
    });
    await expect(stat(lockDirectory)).resolves.toBeDefined();
    await lock.release();
  });

  it("does not remove a successor lock when an old owner releases late", async () => {
    const tokenDirectory = await createTokenDirectory();
    const lockDirectory = join(tokenDirectory, OAUTH_FLOW_LOCK_DIRECTORY);
    const oldLock = await acquireOAuthFlowLock(tokenDirectory);
    await rename(lockDirectory, `${lockDirectory}.stale-test`);
    await mkdir(lockDirectory);
    const successorOwner = join(lockDirectory, "owner-successor.json");
    await writeFile(successorOwner, "{}");

    await oldLock.release();

    await expect(stat(successorOwner)).resolves.toBeDefined();
  });
});
