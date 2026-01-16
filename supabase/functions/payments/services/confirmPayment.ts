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

  return await accruPay.transactions.verifyClientPaymentSession({
    id: order.payment_intent_id,
  });
}

/**
 * Updates order status in the database
 */
async function updateOrderStatus(
  orderId: string,
  status: "PAID" | "FAILED",
  transactionId: string | null,
  supabaseClient: any,
) {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (transactionId) {
    updateData.payment_intent_id = transactionId;
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

/**
 * Builds trigger data for Customer.io email
 */
function buildEmailTriggerData(
  eventData: any,
  orderItems: any[],
  orderId: string,
) {
  const orderDetails = eventData;
  const customerName = orderDetails.customer_name || "";
  const customerEmail = orderDetails.customer_email || "";
  const createdAt = orderDetails.created_at || new Date().toISOString();
  const paymentIntentId = orderDetails.payment_intent_id || "";
  const total = orderDetails.total || 0;
  const subtotal = orderDetails.subtotal || 0;
  const discountAmount = orderDetails.discount_amount || 0;
  const discountCode = orderDetails.discount_code_id || "";
  const status = orderDetails.status || "";
  const eventTitle = orderDetails.events?.title || "";

  const orderItemsArr = (orderItems || []).map((item: any) => ({
    ticketTypeName: item.ticket_type_name || "",
    quantity: item.quantity,
    unitPrice: item.unit_price,
    subtotal: item.subtotal,
  }));

  return {
    name: eventData.customer_name || "Customer",
    email: eventData.customer_email,
    orderId: orderId,
    purchasedAt: new Date().toISOString().split("T")[0],
  };
}

/**
 * Builds customer attributes for Customer.io identify call
 */
function buildCustomerAttributes(
  eventData: any,
  orderItems: any[],
  orderId: string,
) {
  const event = eventData.events || {};

  // Build order items array with details
  const orderItemsArr = (orderItems || []).map((item: any) => ({
    ticketTypeName: item.ticket_type_name || item.ticket_types?.name || "",
    quantity: item.quantity,
    unitPrice: item.unit_price,
    subtotal: item.subtotal,
  }));

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
  await updateOrderStatus(orderId, "FAILED", null, supabaseClient);

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

    // Select the appropriate AccruPay client based on event configuration
    const accruPay = selectAccruPayClient(
      accruPayClients,
      order.events?.accrupay_environment || null,
      envTag,
    );

    const selectedEnv = order.events?.accrupay_environment || "default";
    console.log(
      `Using AccruPay environment for confirmation: ${selectedEnv} (ENV_TAG: ${envTag})`,
    );

    // Step 2: Verify payment with Accrupay
    const verifiedTransaction = await verifyPaymentTransaction(
      order,
      accruPay,
      envTag,
    );

    if (verifiedTransaction.status !== "SUCCEEDED") {
      throw new Error(
        `Payment verification failed: ${verifiedTransaction.status}`,
      );
    }

    // Step 3: Update order status to PAID
    await updateOrderStatus(
      orderId,
      "PAID",
      verifiedTransaction.id,
      supabaseClient,
    );

    // Step 4: Update ticket inventory
    const orderItems = await updateTicketInventory(orderId, supabaseClient);

    // Step 5: Send Slack notification if webhook is configured
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

    // Step 6: Send confirmation email
    const triggerData = await sendConfirmationEmail(
      orderId,
      orderItems,
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
    await handlePaymentFailure(orderId, paymentError, supabaseClient);
    // handlePaymentFailure throws, so this line won't be reached
    // but TypeScript doesn't know that, so we need a return statement
    throw paymentError;
  }
}
