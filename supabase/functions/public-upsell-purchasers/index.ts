/* eslint-disable */
// @ts-nocheck

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
};

Deno.serve(async (req) => {
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

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    const apiKey = req.headers.get("X-API-Key");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing X-API-Key header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let upsellingId: string;
    let email: string;

    if (req.method === "GET") {
      const url = new URL(req.url);
      upsellingId = url.searchParams.get("upselling_id") ?? "";
      email = url.searchParams.get("email") ?? "";
    } else if (req.method === "POST") {
      const body = await req.json();
      upsellingId = body.upselling_id ?? "";
      email = body.email ?? "";
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use GET or POST." }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!upsellingId) {
      return new Response(
        JSON.stringify({ error: "Missing upselling_id parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing email parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Fetch upselling with event to validate API key
    const { data: upselling, error: upsellingError } = await supabaseClient
      .from("upsellings")
      .select(`
        id,
        item,
        event_id,
        events!inner(api_key)
      `)
      .eq("id", upsellingId)
      .maybeSingle();

    if (upsellingError) throw upsellingError;

    if (!upselling) {
      return new Response(
        JSON.stringify({ error: "Upselling not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (upselling.events.api_key !== apiKey) {
      return new Response(
        JSON.stringify({ error: "Invalid API key for this upselling's event" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const eventId = upselling.event_id;

    // Get order IDs that have this upselling
    const { data: orderItems, error: itemsError } = await supabaseClient
      .from("order_items")
      .select("order_id")
      .eq("upselling_id", upsellingId);

    if (itemsError) throw itemsError;

    const orderIds = [...new Set((orderItems ?? []).map((oi: { order_id: string }) => oi.order_id))];

    if (orderIds.length === 0) {
      return new Response(
        JSON.stringify({ purchased: false }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if any PAID order with this email contains the upselling
    const { data: matchingOrder, error: ordersError } = await supabaseClient
      .from("orders")
      .select("id")
      .in("id", orderIds)
      .eq("event_id", eventId)
      .eq("status", "PAID")
      .ilike("customer_email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (ordersError) throw ordersError;

    const purchased = !!matchingOrder;

    return new Response(
      JSON.stringify({ purchased }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    const message = error?.message || "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
