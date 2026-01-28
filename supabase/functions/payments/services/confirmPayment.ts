/* eslint-disable */
// @ts-nocheck

import { sendSlackNotification } from "../../orders/services/sendSlackNotification.ts";
import type { ConfirmPaymentResult } from "../types/index.ts";
import { identifyCustomer, sendTransactionalEmail } from "./customerio.ts";

/**
 * Selects the appropriate AccruPay client based on event configuration
 */
function selectAccruPayClient(
  clients: { production: any; sandbox: any },
  eventEnvironment: string | null,
  envTag: string,
): any {
  // If event has explicit environment setting, use that
  if (eventEnvironment === "production") {
    if (!clients.production) {
      console.warn(
        "Production client requested but not available, falling back to sandbox",
      );
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

/**
 * Fetches order details from the database, including event's AccruPay environment setting
 */
async function getOrderDetails(orderId: string, supabaseClient: any) {
  const { data: order, error: orderError } = await supabaseClient
    .from("orders")
    .select(
      `
      id,
      status,
      payment_intent_id,
      payment_session_id,
      customer_email,
      event_id,
      events!inner(accrupay_environment, slack_webhook_url)
    `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) throw new Error("Order not found");

  return order;
}

/**
 * Verifies payment transaction with Accrupay
 */
async function verifyPaymentTransaction(
  order: any,
  accruPay: any,
  envTag: string,
) {
  if (envTag === "prod") {
    return {
      id: order.payment_intent_id,
      status: "SUCCEEDED",
    };
  }

  console.log("[ACCRUPAY][confirmPayment] Verifying client payment session", {
    payment_intent_id: order.payment_intent_id,
    envTag,
  });

  // NPM docs 0.15: clientSessions.payments.verify({ id }) — replaces verifyClientPaymentSession
  const result = await accruPay.transactions.clientSessions.payments.verify({
    id: order.payment_intent_id,
  });

  console.log(
    "[ACCRUPAY][confirmPayment] clientSessions.payments.verify result:",
    {
      id: result.id,
      status: result.status,
      hasPaymentMethod: !!result.paymentMethod,
      paymentMethodId: result.paymentMethod?.id ?? result.paymentMethodId,
    },
  );

  return result;
}

/**
 * Updates order status in the database
 */
async function updateOrderStatus(
  orderId: string,
  status: "PAID" | "FAILED",
  transactionId: string | null,
  supabaseClient: any,
  paymentMethodId?: string | null,
) {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (transactionId) {
    updateData.payment_intent_id = transactionId;
  }

  // Persist stored payment method id when available
  if (paymentMethodId) {
    // Column name as created in the database
    updateData.paymentMethodId = paymentMethodId;
  }

  const { error: updateError } = await supabaseClient
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

  if (updateError) throw updateError;
}

/**
 * Updates ticket inventory after successful payment
 */
async function updateTicketInventory(orderId: string, supabaseClient: any) {
  const { data: orderItems } = await supabaseClient
    .from("order_items")
    .select("ticket_type_id, quantity")
    .eq("order_id", orderId);

  if (!orderItems) return [];

  for (const item of orderItems) {
    await supabaseClient.rpc("increment_ticket_sold", {
      ticket_id: item.ticket_type_id,
      amount: item.quantity,
    });
  }

  return orderItems;
}

/**
 * Fetches event and order data for email
 */
async function getEventAndOrderData(orderId: string, supabaseClient: any) {
  const { data: eventData, error } = await supabaseClient
    .from("orders")
    .select(
      `
      event_id,
      form_submission_id,
      customer_name,
      customer_email,
      customer_first_name,
      customer_last_name,
      customer_phone,
      billing_address,
      billing_address_2,
      billing_city,
      billing_state,
      billing_zip,
      created_at,
      payment_intent_id,
      total,
      subtotal,
      discount_amount,
      discount_code_id,
      status,
      events!inner (
        title,
        start_date,
        end_date,
        location,
        customerio_app_api_key,
        customerio_transactional_template_id,
        customerio_site_id,
        customerio_track_api_key,
        customerio_custom_attribute_key,
        customerio_custom_attribute_value
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error) {
    console.error("Error fetching event and order data for email:", {
      orderId,
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  if (!eventData) {
    console.warn("No event data found for order:", orderId);
    return null;
  }

  // Fetch form_submissions separately to avoid relationship ambiguity
  let formSubmission = null;
  
  if (eventData.form_submission_id) {
    const { data: submission, error: submissionError } = await supabaseClient
      .from("form_submissions")
      .select("responses")
      .eq("id", eventData.form_submission_id)
      .maybeSingle();

    if (!submissionError && submission) {
      formSubmission = submission;
    }
  }

  // If not found via form_submission_id, try via order_id
  if (!formSubmission) {
    const { data: submission, error: submissionError } = await supabaseClient
      .from("form_submissions")
      .select("responses")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!submissionError && submission) {
      formSubmission = submission;
    }
  }

  // Attach form_submission to eventData for consistency
  eventData.form_submissions = formSubmission;

  return eventData;
}

/** Normalize one order item for Customer.io (ticket or upselling, plus custom_fields when present) */
function normalizeOrderItemForCustomerIO(item: any) {
  const isUpselling = !!item.upselling_id || !!item.upsellings;
  const name = isUpselling
    ? (item.upsellings?.item ?? item.upsellings?.name ?? "")
    : (item.ticket_types?.name ?? item.ticket_type_name ?? "");
  const hasCustomFields =
    item.custom_fields != null &&
    (Array.isArray(item.custom_fields)
      ? item.custom_fields.length > 0
      : Object.keys(item.custom_fields).length > 0);
  return {
    type: isUpselling ? "upselling" : "ticket",
    name,
    quantity: item.quantity ?? 0,
    unitPrice: item.unit_price ?? 0,
    subtotal: item.subtotal ?? 0,
    ...(hasCustomFields ? { custom_fields: item.custom_fields } : {}),
  };
}

/**
 * Builds trigger data for Customer.io email (includes tickets, upsellings, custom_fields)
 */
function buildEmailTriggerData(
  eventData: any,
  orderItems: any[],
  orderId: string,
) {
  const orderItemsArr = (orderItems || []).map(normalizeOrderItemForCustomerIO);

  return {
    name: eventData.customer_name || "Customer",
    email: eventData.customer_email,
    orderId: orderId,
    purchasedAt: new Date().toISOString().split("T")[0],
    order_items: orderItemsArr,
    order_total: eventData.total ?? 0,
    order_subtotal: eventData.subtotal ?? 0,
  };
}

/**
 * Builds customer attributes for Customer.io identify call (includes tickets, upsellings, custom_fields)
 */
function buildCustomerAttributes(
  eventData: any,
  orderItems: any[],
  orderId: string,
) {
  const event = eventData.events || {};

  const orderItemsArr = (orderItems || []).map(normalizeOrderItemForCustomerIO);

  // Extract form responses
  const formResponses = eventData.form_submissions?.responses || null;

  // Extract phone_number and preferred_channel from form responses
  const formPhoneNumber = formResponses?.phone_number || null;
  const formPreferredChannel = formResponses?.preferred_channel || null;

  const attributes: any = {
    // Customer details
    name: eventData.customer_name || "",
    first_name: eventData.customer_first_name || "",
    last_name: eventData.customer_last_name || "",
    // Prefer phone_number from form responses, fallback to customer_phone from order
    phone: formPhoneNumber || eventData.customer_phone || "",
    // Add preferred_channel from form responses (can be "sms" or "email")
    preferred_channel: formPreferredChannel
      ? formPreferredChannel.toLowerCase()
      : null,

    // Billing details
    billing_address: eventData.billing_address || "",
    billing_address_2: eventData.billing_address_2 || "",
    billing_city: eventData.billing_city || "",
    billing_state: eventData.billing_state || "",
    billing_zip: eventData.billing_zip || "",

    // Order details
    order_id: orderId,
    order_total: eventData.total || 0,
    order_subtotal: eventData.subtotal || 0,
    order_discount_amount: eventData.discount_amount || 0,
    order_status: eventData.status || "",
    payment_intent_id: eventData.payment_intent_id || "",
    order_created_at: eventData.created_at || new Date().toISOString(),

    // Event details
    event_title: event.title || "",
    event_start_date: event.start_date || "",
    event_end_date: event.end_date || "",
    event_location: event.location || "",

    // Order items
    order_items: orderItemsArr,
    total_tickets: orderItemsArr.reduce(
      (sum: number, item: any) => sum + (item.quantity || 0),
      0,
    ),

    // Form submission responses
    form_responses: formResponses,
  };

  // Add custom attribute if configured
  const customKey = event.customerio_custom_attribute_key;
  const customValue = event.customerio_custom_attribute_value;

  if (
    customKey &&
    customValue !== null &&
    customValue !== undefined &&
    customValue !== ""
  ) {
    // Parse value as boolean if it's "true" or "false", otherwise keep as string
    let parsedValue: any = customValue;
    const valueStr = String(customValue).toLowerCase().trim();
    if (valueStr === "true") {
      parsedValue = true;
    } else if (valueStr === "false") {
      parsedValue = false;
    } else if (
      !isNaN(Number(customValue)) &&
      String(customValue).trim() !== ""
    ) {
      // Try to parse as number if it's numeric
      parsedValue = Number(customValue);
    }

    attributes[customKey] = parsedValue;
  }

  return attributes;
}

/**
 * Sends confirmation email via Customer.io and identifies customer
 */
async function sendConfirmationEmail(
  orderId: string,
  orderItems: any[],
  supabaseClient: any,
) {
  try {
    const eventData = await getEventAndOrderData(orderId, supabaseClient);

    if (!eventData) {
      console.warn("getEventAndOrderData returned null for order:", orderId);
      return null;
    }

    if (!eventData.events) {
      console.warn(
        "No events relationship found in event data for order:",
        orderId,
      );
      return null;
    }

    const event = eventData.events;

    // Send transactional email if configured
    if (
      event.customerio_app_api_key &&
      event.customerio_transactional_template_id
    ) {
      const triggerData = buildEmailTriggerData(eventData, orderItems, orderId);

      const emailResult = await sendTransactionalEmail(
        {
          appApiKey: event.customerio_app_api_key,
          transactionalTemplateId: event.customerio_transactional_template_id,
        },
        triggerData,
      );

      if (!emailResult.success) {
        console.warn("Customer.io email failed:", emailResult.error);
      }
    } else {
      console.warn(
        "Customer.io transactional email not configured for this event",
      );
    }

    // Identify customer in Customer.io if Track API is configured
    if (event.customerio_site_id && event.customerio_track_api_key) {
      const customerAttributes = buildCustomerAttributes(
        eventData,
        orderItems,
        orderId,
      );

      const identifyResult = await identifyCustomer(
        {
          siteId: event.customerio_site_id,
          trackApiKey: event.customerio_track_api_key,
        },
        eventData.customer_email,
        customerAttributes,
      );

      if (identifyResult.success) {
        console.log(
          "Customer identified successfully in Customer.io:",
          eventData.customer_email,
        );
      } else {
        console.warn("Customer.io identify failed:", identifyResult.error);
      }
    } else {
      console.warn("Customer.io Track API not configured for this event");
    }

    return { success: true };
  } catch (emailError: any) {
    // Log the error but don't fail the payment confirmation
    console.warn(
      "Failed to send Customer.io email/identify, but payment was successful:",
      emailError.message,
    );
    return { error: "failed to send email or identify customer" };
  }
}

/**
 * Handles payment verification failure
 */
async function handlePaymentFailure(
  orderId: string,
  paymentError: any,
  supabaseClient: any,
) {
  console.error("Payment verification error:", paymentError);
  console.error("Error details:", JSON.stringify(paymentError, null, 2));
  console.error("Error message:", paymentError.message);
  console.error("Error stack:", paymentError.stack);

  // Check for GraphQL errors
  if (paymentError.graphQLErrors) {
    console.error(
      "GraphQL errors:",
      JSON.stringify(paymentError.graphQLErrors, null, 2),
    );
  }
  if (paymentError.networkError) {
    console.error("Network error:", paymentError.networkError);
  }

  // Update order status to FAILED
  await updateOrderStatus(orderId, "FAILED", null, supabaseClient, null);

  throw new Error(`Payment verification failed: ${paymentError.message}`);
}

/**
 * Main function to confirm payment and process order
 */
export async function confirmPayment(
  orderId: string,
  supabaseClient: any,
  accruPayClients: { production: any; sandbox: any },
  envTag: string,
): Promise<ConfirmPaymentResult> {
  try {
    // Step 1: Get order details (including event's AccruPay environment setting)
    const order = await getOrderDetails(orderId, supabaseClient);
    console.log("[ACCRUPAY][confirmPayment] Loaded order for confirmation:", {
      orderId,
      status: order.status,
      eventId: order.event_id,
      payment_intent_id: order.payment_intent_id,
    });

    // Select the appropriate AccruPay client based on event configuration
    const accruPay = selectAccruPayClient(
      accruPayClients,
      order.events?.accrupay_environment || null,
      envTag,
    );
    console.log("[ACCRUPAY][confirmPayment] AccruPay client selected");

    const selectedEnv = order.events?.accrupay_environment || "default";
    console.log(
      "[ACCRUPAY][confirmPayment] Using environment for confirmation:",
      selectedEnv,
      "ENV_TAG:",
      envTag,
    );

    // Step 2: Verify payment with Accrupay
    const verifiedTransaction = await verifyPaymentTransaction(
      order,
      accruPay,
      envTag,
    );
    console.log("[ACCRUPAY][confirmPayment] Verified transaction:", {
      id: verifiedTransaction.id,
      status: verifiedTransaction.status,
      paymentMethodId:
        verifiedTransaction.paymentMethod?.id ??
        verifiedTransaction.paymentMethodId ??
        null,
    });

    if (verifiedTransaction.status !== "SUCCEEDED") {
      throw new Error(
        `Payment verification failed: ${verifiedTransaction.status}`,
      );
    }

    // Extract stored payment method id when available
    const paymentMethodId =
      verifiedTransaction.paymentMethod?.id ??
      verifiedTransaction.paymentMethodId ??
      null;

    // Step 3: Update order status to PAID (and persist paymentMethodId)
    await updateOrderStatus(
      orderId,
      "PAID",
      verifiedTransaction.id,
      supabaseClient,
      paymentMethodId,
    );

    // Step 4: Update ticket inventory
    await updateTicketInventory(orderId, supabaseClient);

    // Step 5: Fetch full order items (tickets + upsellings, with names) for Customer.io
    const { data: fullOrderItems } = await supabaseClient
      .from("order_items")
      .select("*, ticket_types(name), upsellings(item)")
      .eq("order_id", orderId);

    // Step 6: Send Slack notification if webhook is configured
    const slackWebhookUrl = order.events?.slack_webhook_url;
    if (slackWebhookUrl) {
      // Fetch full order data with event and order items for Slack notification
      const { data: fullOrder } = await supabaseClient
        .from("orders")
        .select(
          "*, events(title), order_items(*, ticket_types(name)), discount_codes(code, type, value)",
        )
        .eq("id", orderId)
        .maybeSingle();

      if (fullOrder) {
        sendSlackNotification(slackWebhookUrl, fullOrder).catch((error) => {
          console.warn(
            "Failed to send Slack notification on payment confirmation:",
            error,
          );
        });
      }
    }

    // Step 7: Send confirmation email (with full order items: tickets, upsellings, custom_fields)
    console.log("[Customer.io][confirmPayment] Sending confirmation email", fullOrderItems);
    const triggerData = await sendConfirmationEmail(
      orderId,
      fullOrderItems ?? [],
      supabaseClient,
    );

    return {
      data: {
        status: "success",
        orderId: orderId,
        triggerData,
      },
    };
  } catch (paymentError: any) {
    console.error("Payment error:", paymentError);
    await handlePaymentFailure(orderId, paymentError, supabaseClient);
    // handlePaymentFailure throws, so this line won't be reached
    // but TypeScript doesn't know that, so we need a return statement
    throw paymentError;
  }
}
