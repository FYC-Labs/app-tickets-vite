/* eslint-disable */
// @ts-nocheck

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }

    // Use service role key to bypass RLS policies
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    const { action, id, eventId, upsellingId, quantity, data } =
      await req.json();

    let result;

    switch (action) {
      case "getByEventId": {
        const { data: upsellings, error } = await supabaseClient
          .from("upsellings")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        result = { data: upsellings };
        break;
      }

      case "getById": {
        const { data: upselling, error } = await supabaseClient
          .from("upsellings")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        result = { data: upselling };
        break;
      }

      case "create": {
        const { data: upselling, error } = await supabaseClient
          .from("upsellings")
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        result = { data: upselling };
        break;
      }

      case "update": {
        const { data: upselling, error } = await supabaseClient
          .from("upsellings")
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        result = { data: upselling };
        break;
      }

      case "delete": {
        const { error } = await supabaseClient
          .from("upsellings")
          .delete()
          .eq("id", id);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "checkAvailability": {
        const { data: upselling, error } = await supabaseClient
          .from("upsellings")
          .select("quantity, sold")
          .eq("id", upsellingId)
          .maybeSingle();

        if (error) throw error;
        if (!upselling) throw new Error("Upselling not found");

        const available = upselling.quantity - upselling.sold;
        result = {
          available,
          canPurchase: available >= quantity,
        };
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
