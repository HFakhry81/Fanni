const apiBase = process.env.E2E_API_URL ?? "https://api.upnexa-eg.com";

export async function getOrder(token: string, orderId: string): Promise<{ status?: string }> {
  const res = await fetch(`${apiBase}/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET order failed (${res.status})`);
  }
  return res.json() as Promise<{ status?: string }>;
}

export async function cancelOrder(token: string, orderId: string): Promise<void> {
  const res = await fetch(`${apiBase}/api/orders/${orderId}/cancel`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Cancel failed (${res.status})`);
  }
}

export async function declineOrder(token: string, orderId: string): Promise<void> {
  const res = await fetch(`${apiBase}/api/orders/${orderId}/decline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Decline failed (${res.status})`);
  }
}
