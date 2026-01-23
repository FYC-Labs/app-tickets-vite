/* eslint-disable */
// @ts-nocheck

import type { WebhookResult } from "../types/index.ts";

export async function handleWebhook(
  webhookData: any,
  signature: string,
  supabaseClient: any,
  accruPayClients: { production: any; sandbox: any },
  envTag: string
): Promise<WebhookResult> {
  // Use default environment based on ENV_TAG for webhook verification
  const defaultEnv = envTag === "prod" ? "production" : "sandbox";
  const accruPay = accruPayClients[defaultEnv] || accruPayClients.sandbox;
  
  // Verify webhook signature
  const webhookSecret = Deno.env.get("ACCRUPAY_WEBHOOK_SECRET");

  if (webhookSecret) {
    const isValid = accruPay.verifyWebhookSignature(
      webhookData,
      signature
    );

    if (!isValid) {
      throw new Error("Invalid webhook signature");
    }
  }

  // Process webhook event
  const { eventType, data } = webhookData;

  switch (eventType) {
    case "payment.success":
    case "payment.approved": {
      const orderId = data.metadata?.orderId;

      if (orderId) {
        const { error: updateError } = await supabaseClient
          .from("orders")
          .update({
            status: "PAID",
            payment_intent_id: data.transactionId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("status", "PENDING");

        if (!updateError) {
          // Update ticket inventory
          const { data: orderItems } = await supabaseClient
            .from("order_items")
            .select("ticket_type_id, quantity")
            .eq("order_id", orderId);

          if (orderItems) {
            for (const item of orderItems) {
              await supabaseClient.rpc("increment_ticket_sold", {
                ticket_id: item.ticket_type_id,
                amount: item.quantity,
              });
            }
          }

          // Update discount code usage if applicable
          const { data: order } = await supabaseClient
            .from("orders")
            .select("discount_code_id")
            .eq("id", orderId)
            .maybeSingle();

          if (order?.discount_code_id) {
            await supabaseClient.rpc("increment_discount_usage", {
              discount_id: order.discount_code_id,
            });
          }
        }
      }
      break;
    }

    case "payment.failed":
    case "payment.declined": {
      const orderId = data.metadata?.orderId;

      if (orderId) {
        await supabaseClient
          .from("orders")
          .update({
            status: "FAILED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("status", "PENDING");
      }
      break;
    }
  }

  return { data: { received: true } };
}

