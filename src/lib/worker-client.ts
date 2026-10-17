import "server-only";
export async function workerRequest(
  storeId: string,
  method: "GET" | "POST" = "GET",
) {
  const base = process.env.WHATSAPP_WORKER_URL,
    token = process.env.WHATSAPP_WORKER_TOKEN;
  if (!base || !token) throw Error("Worker not configured");
  const response = await fetch(
    `${base}/sessions/${encodeURIComponent(storeId)}`,
    {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw Error("Worker unavailable");
  return response.json();
}
