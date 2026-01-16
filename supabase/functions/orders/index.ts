/* eslint-disable */
// @ts-nocheck

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSlackNotification } from "./services/sendSlackNotification.ts";
import { syncOrderStatusToCustomerIO } from "./services/syncOrderStatusToCustomerIO.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }

    // Use service role key to bypass RLS policies
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    const {
      action,
      filters,
      id,
      status,
      paymentIntentId,
      items,
      discountCodeId,
      data,
    } = await req.json();

    let result;

    switch (action) {
      case "getAll": {
        // Explicit select to avoid relationship ambiguity
        let query = supabaseClient.from("orders").select(`
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
            payment_environment,
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
            events!inner(title),
            order_items(
              id,
              order_id,
              ticket_type_id,
              quantity,
              unit_price,
              subtotal,
              ticket_types(name)
            )
          `);

        if (filters?.event_id) {
          query = query.eq("event_id", filters.event_id);
        }

        if (filters?.status) {
          query = query.eq("status", filters.status);
        }

        query = query.order("created_at", { ascending: false });

        const { data: orders, error } = await query;
        if (error) throw error;
        result = { data: orders };
        break;
      }

      case "getById": {
        // Explicit select to avoid relationship ambiguity between orders and form_submissions
        // Fetch form_submissions separately to avoid the ambiguous relationship
        const { data: order, error } = await supabaseClient
          .from("orders")
          .select(
            `
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
            payment_environment,
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
            events!inner(title),
            order_items(
              id,
              order_id,
              ticket_type_id,
              quantity,
              unit_price,
              subtotal,
              ticket_types(name)
            ),
            discount_codes(code, type, value)
          `,
          )
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;

        // Fetch form_submissions separately if form_submission_id exists
        if (order?.form_submission_id) {
          const { data: formSubmission, error: formError } =
            await supabaseClient
              .from("form_submissions")
              .select(
                `
              id,
              form_id,
              submission_data,
              forms(*)
            `,
              )
              .eq("id", order.form_submission_id)
              .maybeSingle();

          if (!formError && formSubmission) {
            order.form_submissions = formSubmission;
          }
        }

        result = { data: order };
        break;
      }

      case "create": {
        const orderData = data;
        const { items, ...order } = orderData;

        // Determine payment environment from event or ENV_TAG
        // Also fetch Slack webhook URL for notifications
        let paymentEnvironment: string | null = null;
        let slackWebhookUrl: string | null = null;
        if (order.event_id) {
          const { data: event, error: eventError } = await supabaseClient
            .from("events")
            .select("accrupay_environment, slack_webhook_url")
            .eq("id", order.event_id)
            .maybeSingle();

          if (!eventError && event) {
            // If event has explicit environment setting, use that
            if (
              event.accrupay_environment === "production" ||
              event.accrupay_environment === "sandbox"
            ) {
              paymentEnvironment = event.accrupay_environment;
            } else {
              // Otherwise, use global ENV_TAG
              const envTag = Deno.env.get("ENV_TAG") ?? "dev";
              paymentEnvironment = envTag === "prod" ? "production" : "sandbox";
            }
            // Store Slack webhook URL if configured
            slackWebhookUrl = event.slack_webhook_url || null;
          } else {
            // Fallback to ENV_TAG if event lookup fails
            const envTag = Deno.env.get("ENV_TAG") ?? "dev";
            paymentEnvironment = envTag === "prod" ? "production" : "sandbox";
          }
        } else {
          // Fallback to ENV_TAG if no event_id
          const envTag = Deno.env.get("ENV_TAG") ?? "dev";
          paymentEnvironment = envTag === "prod" ? "production" : "sandbox";
        }

        // Add payment_environment to order data
        order.payment_environment = paymentEnvironment;

        const { data: newOrder, error: orderError } = await supabaseClient
          .from("orders")
          .insert(order)
          .select()
          .single();

        if (orderError) throw orderError;

        if (items && items.length > 0) {
          const orderItems = items.map((item: any) => ({
            order_id: newOrder.id,
            ticket_type_id: item.ticket_type_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.quantity * item.unit_price,
          }));

          const { error: itemsError } = await supabaseClient
            .from("order_items")
            .insert(orderItems);

          if (itemsError) throw itemsError;
        }

        const { data: createdOrder } = await supabaseClient
          .from("orders")
          .select(
            "*, events(title), order_items(*, ticket_types(name)), discount_codes(code, type, value)",
          )
          .eq("id", newOrder.id)
          .maybeSingle();

        // Sync order status to Customer.io (for PENDING orders)
        // This allows Customer.io to identify customers with incomplete purchases
        if (createdOrder) {
          if (createdOrder.form_submission_id) {
            const { error: updateSubmissionError } = await supabaseClient
              .from("form_submissions")
              .update({ order_id: createdOrder.id })
              .eq("id", createdOrder.form_submission_id);

            if (updateSubmissionError) {
              console.warn(
                "Failed to update form_submission with order_id:",
                updateSubmissionError,
              );
            }
          }

          syncOrderStatusToCustomerIO(createdOrder.id, supabaseClient).catch(
            (error) => {
              // Log but don't fail the order creation
              console.warn(
                "Failed to sync order status to Customer.io on create:",
                error,
              );
            },
          );

          // Send Slack notification if webhook is configured
          if (slackWebhookUrl) {
            sendSlackNotification(slackWebhookUrl, createdOrder).catch(
              (error) => {
                // Log but don't fail the order creation
                console.warn(
                  "Failed to send Slack notification on create:",
                  error,
                );
              },
            );
          }
        }

        result = { data: createdOrder };
        break;
      }

      case "updateStatus": {
        const updateData: any = {
          status,
          updated_at: new Date().toISOString(),
        };

        if (paymentIntentId) {
          updateData.payment_intent_id = paymentIntentId;
        }

        const { data: order, error } = await supabaseClient
          .from("orders")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        if (status === "PAID") {
          const { data: orderItems } = await supabaseClient
            .from("order_items")
            .select("ticket_type_id, quantity")
            .eq("order_id", id);

          if (orderItems) {
            for (const item of orderItems) {
              await supabaseClient.rpc("increment_ticket_sold", {
                ticket_id: item.ticket_type_id,
                amount: item.quantity,
              });
            }
          }
        }

        // Sync order status to Customer.io whenever status changes
        // This ensures Customer.io always has the latest order status
        // (e.g., PENDING -> PAID, PENDING -> CANCELLED, etc.)
        if (order) {
          syncOrderStatusToCustomerIO(order.id, supabaseClient).catch(
            (error) => {
              // Log but don't fail the status update
              console.warn(
                "Failed to sync order status to Customer.io on update:",
                error,
              );
            },
          );

          // Send Slack notification when order status changes to PAID
          if (status === "PAID" && order.event_id) {
            // Fetch event's Slack webhook URL
            const { data: event } = await supabaseClient
              .from("events")
              .select("slack_webhook_url")
              .eq("id", order.event_id)
              .maybeSingle();

            if (event?.slack_webhook_url) {
              // Fetch full order data with event and order items
              const { data: fullOrder } = await supabaseClient
                .from("orders")
                .select(
                  "*, events(title), order_items(*, ticket_types(name)), discount_codes(code, type, value)",
                )
                .eq("id", order.id)
                .maybeSingle();

              if (fullOrder) {
                sendSlackNotification(event.slack_webhook_url, fullOrder).catch(
                  (error) => {
                    console.warn(
                      "Failed to send Slack notification on status update:",
                      error,
                    );
                  },
                );
              }
            }
          }
        }

        result = { data: order };
        break;
      }

      case "calculateTotal": {
        let subtotal = 0;

        for (const item of items) {
          const { data: ticket } = await supabaseClient
            .from("ticket_types")
            .select("price")
            .eq("id", item.ticket_type_id)
            .single();

          if (ticket) {
            subtotal += parseFloat(ticket.price) * item.quantity;
          }
        }

        let discountAmount = 0;

        if (discountCodeId) {
          const { data: discount } = await supabaseClient
            .from("discount_codes")
            .select("type, value")
            .eq("id", discountCodeId)
            .single();

          if (discount) {
            if (discount.type === "PERCENT") {
              discountAmount = (subtotal * parseFloat(discount.value)) / 100;
            } else {
              discountAmount = parseFloat(discount.value);
            }
          }
        }

        const total = Math.max(0, subtotal - discountAmount);

        result = {
          subtotal: parseFloat(subtotal.toFixed(2)),
          discount_amount: parseFloat(discountAmount.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
        };
        break;
      }

      case "delete": {
        // First check if order exists and get its items
        const { data: order, error: fetchError } = await supabaseClient
          .from("orders")
          .select("id, status, payment_intent_id")
          .eq("id", id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!order) {
          throw new Error("Order not found");
        }

        // If order was PAID, decrement sold counts before deleting
        if (order.status === "PAID") {
          const { data: orderItems } = await supabaseClient
            .from("order_items")
            .select("ticket_type_id, quantity")
            .eq("order_id", id);

          if (orderItems) {
            for (const item of orderItems) {
              await supabaseClient.rpc("decrement_ticket_sold", {
                ticket_id: item.ticket_type_id,
                amount: item.quantity,
              });
            }
          }
        }

        // Delete the order (order_items will be deleted automatically via CASCADE)
        const { error: deleteError } = await supabaseClient
          .from("orders")
          .delete()
          .eq("id", id);

        if (deleteError) throw deleteError;

        result = { data: { success: true, deletedOrder: order } };
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
  } catch (error: any) {
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
      },
    );
  }
});
