import "server-only";
import { JWT } from "google-auth-library";

type ServiceAccount = { client_email: string; private_key: string; project_id?: string };

export function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  if (!json) return null;
  try {
    const sa = JSON.parse(json) as ServiceAccount;
    return sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

export function googleClient(json: string | undefined, scopes: string[]) {
  const sa = parseServiceAccount(json);
  if (!sa) throw new Error("Invalid service account JSON — paste the full key file downloaded from Google Cloud.");
  return { client: new JWT({ email: sa.client_email, key: sa.private_key, scopes }), email: sa.client_email };
}

export async function googleFetch<T>(client: JWT, url: string, init?: { method?: string; body?: unknown }) {
  const res = await client.request<T>({
    url,
    method: (init?.method ?? "GET") as "GET",
    data: init?.body,
    timeout: 15_000,
  });
  return res.data;
}

export function describeGoogleError(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
  const status = err.response?.status;
  const msg = err.response?.data?.error?.message ?? err.message ?? String(e);
  if (status === 403) return `Permission denied: ${msg}. Make sure the service account has been granted access.`;
  if (status === 404) return `Not found: ${msg}. Check the property / site URL.`;
  if (status === 401) return `Authentication failed: ${msg}`;
  return msg;
}
