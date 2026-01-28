/* eslint-disable */
// @ts-nocheck

import { TRANSACTION_PROVIDER, CURRENCY, COUNTRY_ISO_2 } from "npm:@accrupay/node@0.15.1";
import type { PaymentSessionResult } from "../types/index.ts";

/**
 * Selects the appropriate AccruPay client based on event configuration
 */
function selectAccruPayClient(
  clients: { production: any; sandbox: any },
  eventEnvironment: string | null,
  envTag: string
): any {
  // If event has explicit environment setting, use that
  if (eventEnvironment === "production") {
    if (!clients.production) {
      console.warn("Production client requested but not available, falling back to sandbox");
      return clients.sandbox;
    }
    return clients.production;
  }

  if (eventEnvironment === "sandbox") {
    return clients.sandbox;
  }

  // Otherwise, use global ENV_TAG
  const defaultEnv = envTag === "prod" ? "production" : "sandbox";
  return clients[defaultEnv] || clients.sandbox;
}

export async function createPaymentSession(
  orderId: string,
  supabaseClient: any,
  accruPayClients: { production: any; sandbox: any },
  envTag: string
): Promise<PaymentSessionResult> {
  // Get order details - explicit select to avoid relationship ambiguity
  const { data: order, error: orderError } = await supabaseClient
    .from("orders")
    .select(`
      id,
      event_id,
      form_submission_id,
      discount_code_id,
      subtotal,
      discount_amount,
      total,
      status,
      payment_intent_id,
      payment_session_id,
      payment_provider,
      customer_email,
      customer_name,
      customer_first_name,
      customer_last_name,
      customer_phone,
      billing_address,
      billing_address_2,
      billing_city,
      billing_state,
      billing_zip,
      created_at,
      updated_at,
      events!inner(title, accrupay_environment),
      order_items(
        id,
        order_id,
        ticket_type_id,
        quantity,
        unit_price,
        subtotal,
        ticket_types(name)
      )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) throw new Error("Order not found");

  // Select the appropriate AccruPay client based on event configuration
  const accruPay = selectAccruPayClient(
    accruPayClients,
    order.events?.accrupay_environment || null,
    envTag,
  );

  const selectedEnv = order.events?.accrupay_environment || "default";
  console.log(
    "[ACCRUPAY][createPaymentSession] Using environment:",
    selectedEnv,
    "ENV_TAG:",
    envTag,
  );


  if (order.status !== "PENDING") {
    throw new Error(`Order status is ${order.status}, cannot create payment session`);
  }

  // Create payment session with Accrupay/Nuvei
  try {
    // Convert amount to bigint (cents)
    const amountInCents = Math.round(parseFloat(order.total) * 100);

    console.log("[ACCRUPAY][createPaymentSession] Creating client session", {
      orderId,
      status: order.status,
      amountInCents,
      customerEmail: order.customer_email,
    });

    const sessionData = {
      transactionProvider: TRANSACTION_PROVIDER.NUVEI,
      data: {
        amount: BigInt(amountInCents),
        currency: CURRENCY.USD,
        billing: {
          billingFirstName: order.customer_first_name || "Guest",
          billingLastName: order.customer_last_name || "User",
          billingEmail: order.customer_email,
          billingPhone: order.customer_phone || null,
          billingAddressCountry: COUNTRY_ISO_2.US,
          billingAddressState: order.billing_state || "CA",
          billingAddressCity: order.billing_city || "City",
          billingAddressLine1: order.billing_address || "123 Main St",
          billingAddressLine2: order.billing_address_2 || null,
          billingAddressPostalCode: order.billing_zip || "00000",
        },
        storePaymentMethod: true,
        merchantInternalCustomerCode: order.customer_email,
        merchantInternalTransactionCode: order.id,
      },
    };

    console.log(
      "[ACCRUPAY][createPaymentSession] Session data payload:",
      JSON.stringify(sessionData, null, 2),
    );

    // @accrupay/node 0.15+: clientSessions.payments.start (was startClientPaymentSession)
    const session = await accruPay.transactions.clientSessions.payments.start(
      sessionData,
    );
    const transaction = session?.transaction ?? session;
    console.log(
      "[ACCRUPAY][createPaymentSession] Client payment session created:",
      {
        transactionId: transaction?.id ?? session?.id,
        token: transaction?.token ?? session?.token,
        status: transaction?.status ?? session?.status,
      },
    );

    // Pre-session config for React SDK (npm docs: clientSessions.getBaseConfig)
    // Output: { provider: 'NUVEI', data: { merchantId, environment, ... } }
    let preSessionData = null;
    try {
      const config = await accruPay.transactions.clientSessions.getBaseConfig({
        transactionProvider: TRANSACTION_PROVIDER.NUVEI,
      });
      preSessionData = {
        provider: config.provider,
        ...config.data,
        environment: config.data?.environment ?? config.data?.env,
        env: config.data?.environment ?? config.data?.env,
      };
      console.log(
        "[ACCRUPAY][createPaymentSession] Base config loaded:",
        preSessionData.env ?? preSessionData.environment,
      );
    } catch (configError) {
      console.warn(
        "[ACCRUPAY][createPaymentSession] Could not fetch getBaseConfig:",
        configError,
      );
    }

    // Store session information in order
    const { error: updateError } = await supabaseClient
      .from("orders")
      .update({
        payment_session_id: transaction.token,
        payment_provider: "nuvei",
        payment_intent_id: transaction.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    return {
      data: {
        sessionToken: transaction.token,
        transactionId: transaction.id,
        tokenExpiresAt: transaction.tokenExpiresAt,
        preSessionData: preSessionData,
      },
    };
  } catch (paymentError: any) {
    console.error("Accrupay payment session error:", paymentError);
    console.error("Error details:", JSON.stringify(paymentError, null, 2));
    console.error("Error stack:", paymentError.stack);

    // Check for specific error types
    if (paymentError.networkError) {
      console.error("Network error:", paymentError.networkError);
    }
    if (paymentError.graphQLErrors) {
      console.error("GraphQL errors:", paymentError.graphQLErrors);
    }

    throw new Error(
      `Failed to create payment session: ${paymentError.message || JSON.stringify(paymentError)}`
    );
  }
}

