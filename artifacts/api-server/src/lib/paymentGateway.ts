/**
 * Gateway-agnostic recharge adapter.
 * Live path today: manual bank / InstaPay / e-wallet (payment_requests = Recharge Intent).
 * OPay will plug in here when credentials arrive — do not hardcode fees.
 */

export type PaymentProviderId = "manual" | "opay";

export function getPaymentProvider(): PaymentProviderId {
  const raw = process.env["PAYMENT_PROVIDER"]?.trim().toLowerCase();
  return raw === "opay" ? "opay" : "manual";
}

export type GatewayCheckoutInput = {
  technicianId: string;
  packageId: string;
  amountEgp: number;
  pointsRequested: number;
  intentId: string;
};

export type GatewayCheckoutResult =
  | { provider: "manual"; status: "awaiting_transfer" }
  | { provider: "opay"; status: "not_configured" };

export async function startGatewayCheckout(input: GatewayCheckoutInput): Promise<GatewayCheckoutResult> {
  const provider = getPaymentProvider();
  if (provider === "manual") {
    return { provider: "manual", status: "awaiting_transfer" };
  }
  void input;
  return { provider: "opay", status: "not_configured" };
}
