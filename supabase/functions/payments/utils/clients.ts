/* eslint-disable */
// @ts-nocheck

import { createClient } from "npm:@supabase/supabase-js@2";
import { AccruPay, TRANSACTION_PROVIDER } from "npm:@accrupay/node@0.15.1";

export function initializeSupabaseClient() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  // Use service role key to bypass RLS policies
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Initialize both production and sandbox AccruPay clients
 * Returns an object with both clients available
 */
export function initializeAccruPayClients() {
  const ACCRUPAY_SECRET_KEY = Deno.env.get("ACCRUPAY_SECRET_KEY") ?? "";
  const ACCRUPAY_SECRET_KEY_QA = Deno.env.get("ACCRUPAY_SECRET_KEY_QA") ?? "";

  if (!ACCRUPAY_SECRET_KEY_QA) {
    throw new Error("ACCRUPAY_SECRET_KEY_QA is not set");
  }

  const clients: { production: any; sandbox: any } = {
    production: null,
    sandbox: null,
  };

  // Initialize sandbox/QA client (always required)
  try {
    clients.sandbox = new AccruPay({
      apiSecret: ACCRUPAY_SECRET_KEY_QA,
      environment: "qa",
      onAuthError: () => {
        console.error("AccruPay Sandbox Authentication Error - onAuthError callback triggered");
      },
      onGraphQLError: (errors) => {
        console.error("AccruPay Sandbox GraphQL Errors:", JSON.stringify(errors, null, 2));
      },
      onNetworkError: (error) => {
        console.error("AccruPay Sandbox Network Error:", error);
      },
    });
  } catch (initError) {
    console.error("Failed to initialize AccruPay sandbox client:", initError);
    throw new Error(`AccruPay sandbox initialization failed: ${initError.message}`);
  }

  // Initialize production client (only if key is provided)
  if (ACCRUPAY_SECRET_KEY) {
    try {
      clients.production = new AccruPay({
        apiSecret: ACCRUPAY_SECRET_KEY,
        environment: "production",
        onAuthError: () => {
          console.error("AccruPay Production Authentication Error - onAuthError callback triggered");
        },
        onGraphQLError: (errors) => {
          console.error("AccruPay Production GraphQL Errors:", JSON.stringify(errors, null, 2));
        },
        onNetworkError: (error) => {
          console.error("AccruPay Production Network Error:", error);
        },
      });
    } catch (initError) {
      console.error("Failed to initialize AccruPay production client:", initError);
      console.warn("Production client not available, will fall back to sandbox");
    }
  }

  return clients;
}

/**
 * Backwards compatible function that returns a single client based on ENV_TAG
 * @deprecated Use initializeAccruPayClients() for new code
 */
export function initializeAccruPayClient() {
  const ENV_TAG = Deno.env.get("ENV_TAG") ?? "dev";
  const clients = initializeAccruPayClients();
  const environment = ENV_TAG === "prod" ? "production" : "sandbox";

  return clients[environment] || clients.sandbox;
}

export function getEnvironment() {
  return Deno.env.get("ENV_TAG") ?? "dev";
}

