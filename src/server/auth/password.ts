import "server-only";
import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended Argon2id parameters (m=19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(stored: string | null | undefined, password: string) {
  if (!stored) {
    // Spend comparable time so missing accounts aren't revealed by timing.
    await hash(password, OPTIONS);
    return false;
  }
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** Reasonable strength rules without being hostile. */
export function passwordIssues(password: string, minLength: number): string[] {
  const issues: string[] = [];
  if (password.length < minLength) issues.push("tooShort");
  if (password.length > 256) issues.push("tooLong");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes < 2) issues.push("tooSimple");
  return issues;
}
