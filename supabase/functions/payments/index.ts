/* eslint-disable */
// @ts-nocheck

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { initializeSupabaseClient, initializeAccruPayClients, getEnvironment } from "./utils/clients.ts";
import { createPaymentSession } from "./services/createPaymentSession.ts";
import { confirmPayment } from "./services/confirmPayment.ts";
import { handleWebhook } from "./services/handleWebhook.ts";
import { getPaymentSession } from "./services/getPaymentSession.ts";
import { getProviders } from "./services/getProviders.ts";
import { chargeUpsellingsWithStoredMethod } from "./services/chargeUpsellings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize clients
    const supabaseClient = initializeSupabaseClient();
    const accruPayClients = initializeAccruPayClients();
    const envTag = getEnvironment();

    // Parse request body
    const { action, orderId, paymentData, webhookData, items } = await req.json();

    let result;

    // Route to appropriate service based on action
    switch (action) {
      case "createPaymentSession": {
        result = await createPaymentSession(orderId, supabaseClient, accruPayClients, envTag);
        break;
      }

      case "confirmPayment": {
        result = await confirmPayment(orderId, supabaseClient, accruPayClients, envTag);
        break;
      }

      case "chargeUpsellings": {
        result = await chargeUpsellingsWithStoredMethod(
          orderId,
          items,
          supabaseClient,
          accruPayClients,
          envTag,
        );
        break;
      }

      case "handleWebhook": {
        const signature = req.headers.get("x-accrupay-signature") || "";
        result = await handleWebhook(webhookData, signature, supabaseClient, accruPayClients, envTag);
        break;
      }

      case "getPaymentSession": {
        result = await getPaymentSession(orderId, supabaseClient);
        break;
      }

      case "getProviders": {
        result = await getProviders(accruPayClients, envTag);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Payment function error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
