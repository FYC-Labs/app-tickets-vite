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

    const { action, id, eventId, ticketTypeId, quantity, data } =
      await req.json();

    let result;

    switch (action) {
      case "getByEventId": {
        const { data: tickets, error } = await supabaseClient
          .from("ticket_types")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        result = { data: tickets };
        break;
      }

      case "getById": {
        const { data: ticket, error } = await supabaseClient
          .from("ticket_types")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        result = { data: ticket };
        break;
      }

      case "create": {
        const { data: ticket, error } = await supabaseClient
          .from("ticket_types")
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        result = { data: ticket };
        break;
      }

      case "update": {
        const { data: ticket, error } = await supabaseClient
          .from("ticket_types")
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        result = { data: ticket };
        break;
      }

      case "delete": {
        const { error } = await supabaseClient
          .from("ticket_types")
          .delete()
          .eq("id", id);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "checkAvailability": {
        const { data: ticket, error } = await supabaseClient
          .from("ticket_types")
          .select("quantity, sold")
          .eq("id", ticketTypeId)
          .maybeSingle();

        if (error) throw error;
        if (!ticket) throw new Error("Ticket type not found");

        const available = ticket.quantity - ticket.sold;
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
