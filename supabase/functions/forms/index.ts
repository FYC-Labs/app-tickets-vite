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

    const { action, filters, id, formId, responses, email, data } = await req.json();

    let result;

    switch (action) {
      case "getAll": {
        let query = supabaseClient.from("forms").select("*, events(title)");

        if (filters?.event_id) {
          query = query.eq("event_id", filters.event_id);
        }

        if (filters?.is_published !== undefined) {
          query = query.eq("is_published", filters.is_published);
        }

        query = query.order("created_at", { ascending: false });

        const { data: forms, error } = await query;
        if (error) throw error;
        result = { data: forms };
        break;
      }

      case "getById": {
        const { data: form, error } = await supabaseClient
          .from("forms")
          .select("*, events(title, id)")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        result = { data: form };
        break;
      }

      case "create": {
        // Validate required fields
        if (!data.event_id) {
          throw new Error("event_id is required");
        }

        // Validate and filter ticket IDs if provided
        if (data.available_ticket_ids && data.available_ticket_ids.length > 0) {
          const { data: tickets, error: ticketError } = await supabaseClient
            .from("ticket_types")
            .select("id")
            .eq("event_id", data.event_id)
            .in("id", data.available_ticket_ids);

          if (ticketError) throw ticketError;

          if (!tickets || tickets.length === 0) {
            // No valid tickets found - clear the array
            data.available_ticket_ids = [];
          } else if (tickets.length !== data.available_ticket_ids.length) {
            // Some tickets are invalid - filter to only valid ones
            const validTicketIds = tickets.map((t) => t.id);
            const invalidCount = data.available_ticket_ids.length - validTicketIds.length;
            data.available_ticket_ids = validTicketIds;

            // Log warning but don't throw error - just use valid tickets
            console.warn(
              `Filtered out ${invalidCount} invalid ticket ID(s) that don't belong to event ${data.event_id}`
            );
          }
        }

        // created_by should be passed in the data from the client
        // It should be the user's Supabase ID (from users table, not auth.users)
        const { data: form, error } = await supabaseClient
          .from("forms")
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        result = { data: form };
        break;
      }

      case "update": {
        // Get the form's event_id if not provided in update data
        let eventId = data.event_id;
        if (!eventId) {
          const { data: existingForm, error: formError } = await supabaseClient
            .from("forms")
            .select("event_id")
            .eq("id", id)
            .maybeSingle();

          if (formError) throw formError;
          if (!existingForm) {
            throw new Error("Form not found");
          }
          eventId = existingForm.event_id;
        }

        // Validate and filter ticket IDs if provided
        if (data.available_ticket_ids && data.available_ticket_ids.length > 0 && eventId) {
          const { data: tickets, error: ticketError } = await supabaseClient
            .from("ticket_types")
            .select("id")
            .eq("event_id", eventId)
            .in("id", data.available_ticket_ids);

          if (ticketError) throw ticketError;

          if (!tickets || tickets.length === 0) {
            // No valid tickets found - clear the array
            data.available_ticket_ids = [];
          } else if (tickets.length !== data.available_ticket_ids.length) {
            // Some tickets are invalid - filter to only valid ones
            const validTicketIds = tickets.map((t) => t.id);
            const invalidCount = data.available_ticket_ids.length - validTicketIds.length;
            data.available_ticket_ids = validTicketIds;

            // Log warning but don't throw error - just use valid tickets
            console.warn(
              `Filtered out ${invalidCount} invalid ticket ID(s) that don't belong to event ${eventId}`
            );
          }
        }

        const { data: form, error } = await supabaseClient
          .from("forms")
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        result = { data: form };
        break;
      }

      case "delete": {
        const { error } = await supabaseClient.from("forms").delete().eq("id", id);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "submitForm": {
        const { data: submission, error } = await supabaseClient
          .from("form_submissions")
          .insert({
            form_id: formId,
            responses,
            email,
          })
          .select()
          .single();

        if (error) throw error;
        result = { data: submission };
        break;
      }

      case "getSubmissions": {
        const { data: submissions, error } = await supabaseClient
          .from("form_submissions")
          .select("*, orders(*)")
          .eq("form_id", formId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        result = { data: submissions };
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
      }
    );
  }
});
