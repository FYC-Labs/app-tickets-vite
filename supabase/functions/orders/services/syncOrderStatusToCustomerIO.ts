/* eslint-disable */
// @ts-nocheck

import { identifyCustomer } from "../../payments/services/customerio.ts";

/**
 * Fetches order and event data needed for Customer.io sync
 */
async function getOrderAndEventData(orderId: string, supabaseClient: any) {
  const { data: orderData, error } = await supabaseClient
    .from("orders")
    .select(
      `
      id,
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
      status,
      events!inner (
        title,
        start_date,
        end_date,
        location,
        customerio_site_id,
        customerio_track_api_key,
        customerio_custom_attribute_key,
        customerio_custom_attribute_value
      ),
      order_items(
        id,
        quantity,
        unit_price,
        subtotal,
        ticket_types(name)
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error) {
    console.error("Error fetching order data for Customer.io sync:", {
      orderId,
      error: error.message,
    });
    return null;
  }

  if (!orderData) {
    console.warn("No order data found for Customer.io sync:", orderId);
    return null;
  }

  let formSubmission = null;
  
  if (orderData.form_submission_id) {
    const { data: submission, error: submissionError } = await supabaseClient
      .from("form_submissions")
      .select("responses")
      .eq("id", orderData.form_submission_id)
      .maybeSingle();

    if (!submissionError && submission) {
      formSubmission = submission;
    }
  }

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

  orderData.form_submissions = formSubmission;

  console.log("[DEBUG] Form submissions data:", {
    orderId,
    form_submission_id: orderData.form_submission_id,
    form_submissions: orderData.form_submissions,
    form_submissions_type: typeof orderData.form_submissions,
    is_array: Array.isArray(orderData.form_submissions),
  });

  return orderData;
}

/**
 * Builds customer attributes for Customer.io identify call
 */
function buildCustomerAttributes(orderData: any) {
  const event = orderData.events || {};

  // Build order items array with details
  const orderItemsArr = (orderData.order_items || []).map((item: any) => ({
    ticketTypeName: item.ticket_types?.name || "",
    quantity: item.quantity,
    unitPrice: item.unit_price,
    subtotal: item.subtotal,
  }));

  const formResponses = orderData.form_submissions?.responses || null;

  const formPhoneNumber = formResponses?.phone_number || null;
  const formPreferredChannel = formResponses?.preferred_channel || null;

  const attributes: any = {
    // Customer details
    name: orderData.customer_name || "",
    first_name: orderData.customer_first_name || "",
    last_name: orderData.customer_last_name || "",
    phone: formPhoneNumber || orderData.customer_phone || "",
    preferred_channel: formPreferredChannel
      ? formPreferredChannel.toLowerCase()
      : null,

    // Billing details
    billing_address: orderData.billing_address || "",
    billing_address_2: orderData.billing_address_2 || "",
    billing_city: orderData.billing_city || "",
    billing_state: orderData.billing_state || "",
    billing_zip: orderData.billing_zip || "",

    // Order details
    order_id: orderData.id,
    order_total: orderData.total || 0,
    order_subtotal: orderData.subtotal || 0,
    order_discount_amount: orderData.discount_amount || 0,
    order_status: orderData.status || "",
    payment_intent_id: orderData.payment_intent_id || "",
    order_created_at: orderData.created_at || new Date().toISOString(),

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

    form_responses: formResponses,
  };

  console.log("[DEBUG] Form responses extraction:", {
    form_submissions_raw: orderData.form_submissions,
    form_responses_extracted: formResponses,
    phone_number_from_form: formPhoneNumber,
    preferred_channel_from_form: formPreferredChannel,
    final_phone_in_attributes: attributes.phone,
    final_preferred_channel_in_attributes: attributes.preferred_channel,
  });

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
 * Syncs order status to Customer.io
 * This function identifies/updates a customer in Customer.io with their current order status.
 * This allows Customer.io to segment users based on order status (PENDING, PAID, CANCELLED, REFUNDED).
 *
 * @param orderId - The ID of the order to sync
 * @param supabaseClient - Supabase client instance
 * @returns Promise with success status
 */
export async function syncOrderStatusToCustomerIO(
  orderId: string,
  supabaseClient: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    const orderData = await getOrderAndEventData(orderId, supabaseClient);

    if (!orderData) {
      return {
        success: false,
        error: "Order data not found",
      };
    }

    if (!orderData.events) {
      return {
        success: false,
        error: "Event data not found for order",
      };
    }

    const event = orderData.events;

    // Only sync if Customer.io Track API is configured
    if (!event.customerio_site_id || !event.customerio_track_api_key) {
      // Silently skip if not configured - this is expected for events without Customer.io
      return {
        success: true,
      };
    }

    const customerAttributes = buildCustomerAttributes(orderData);

    console.log("[DEBUG] Customer attributes before Customer.io sync:", {
      orderId,
      customer_email: orderData.customer_email,
      form_responses: customerAttributes.form_responses,
      has_form_responses: !!customerAttributes.form_responses,
      phone: customerAttributes.phone,
      preferred_channel: customerAttributes.preferred_channel,
    });

    const identifyResult = await identifyCustomer(
      {
        siteId: event.customerio_site_id,
        trackApiKey: event.customerio_track_api_key,
      },
      orderData.customer_email,
      customerAttributes,
    );

    if (identifyResult.success) {
      console.log(
        `Order status synced to Customer.io for order ${orderId}, customer ${orderData.customer_email}, status: ${orderData.status}`,
      );
      return { success: true };
    } else {
      console.warn(
        `Failed to sync order status to Customer.io for order ${orderId}:`,
        identifyResult.error,
      );
      return {
        success: false,
        error: identifyResult.error,
      };
    }
  } catch (error: any) {
    // Log the error but don't fail the order operation
    console.error(
      `Error syncing order status to Customer.io for order ${orderId}:`,
      error.message,
    );
    return {
      success: false,
      error: error.message,
    };
  }
}
