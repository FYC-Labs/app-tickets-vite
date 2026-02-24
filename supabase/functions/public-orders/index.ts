/* eslint-disable */
// @ts-nocheck

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }

    // Use service role key to bypass RLS policies
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // Extract API key from header
    const apiKey = req.headers.get("X-API-Key");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing X-API-Key header",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get order_id from request
    let orderId: string;
    
    if (req.method === "GET") {
      const url = new URL(req.url);
      orderId = url.searchParams.get("order_id") ?? "";
    } else if (req.method === "POST") {
      const body = await req.json();
      orderId = body.order_id;
    } else {
      return new Response(
        JSON.stringify({
          error: "Method not allowed. Use GET or POST.",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!orderId) {
      return new Response(
        JSON.stringify({
          error: "Missing order_id parameter",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Fetch the order with event details to validate API key
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
        events!inner(
          id,
          title,
          description,
          start_date,
          end_date,
          location,
          api_key
        ),
        order_items(
          id,
          order_id,
          ticket_type_id,
          quantity,
          unit_price,
          subtotal,
          ticket_types(
            id,
            name,
            description,
            price
          )
        ),
        discount_codes(
          code,
          type,
          value
        )
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    if (!order) {
      return new Response(
        JSON.stringify({
          error: "Order not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Validate that the API key matches the event's API key
    if (order.events.api_key !== apiKey) {
      return new Response(
        JSON.stringify({
          error: "Invalid API key for this order's event",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Remove the API key from the event data before returning
    const { api_key, ...eventData } = order.events;
    const responseData = {
      ...order,
      events: eventData,
    };

    return new Response(
      JSON.stringify({
        data: responseData,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in public-orders function:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
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

