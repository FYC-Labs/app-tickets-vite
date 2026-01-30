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

    const body = await req.json();
    const { action, id, eventId, upsellingId, quantity, data } = body;

    let result;

    switch (action) {
      case "uploadImage": {
        const { folderId, fileBase64, fileName, contentType } = body;
        if (!eventId || !fileBase64 || !fileName) {
          throw new Error("uploadImage requires eventId, fileBase64, fileName");
        }
        const ext = (fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const uniqueId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const path = `public/${eventId}/${folderId ?? "new"}/${uniqueId}.${ext}`;
        const binary = atob(fileBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const { error } = await supabaseClient.storage
          .from("upselling-images")
          .upload(path, bytes, {
            contentType: contentType || `image/${ext}`,
            cacheControl: "3600",
            upsert: false,
          });
        if (error) throw error;
        const { data: urlData } = supabaseClient.storage.from("upselling-images").getPublicUrl(path);
        let urlForClient = urlData.publicUrl;
        const clientBase = (typeof body.baseUrl === "string" && body.baseUrl.trim())
          ? body.baseUrl.replace(/\/$/, "")
          : SUPABASE_URL.replace(/\/$/, "");
        urlForClient = urlForClient.replace(/^https?:\/\/[^/]+/, clientBase);
        result = { data: { url: urlForClient } };
        break;
      }

      case "getSignedImageUrl": {
        const { path: imagePath, publicUrl } = body;
        let pathToSign = imagePath;
        if (!pathToSign && publicUrl && typeof publicUrl === "string") {
          const bucketPrefix = "/upselling-images/";
          const i = publicUrl.indexOf(bucketPrefix);
          if (i !== -1) pathToSign = publicUrl.slice(i + bucketPrefix.length).replace(/^\//, "").split("?")[0];
        }
        if (!pathToSign || typeof pathToSign !== "string") {
          throw new Error("getSignedImageUrl requires path or publicUrl");
        }
        const pathTrimmed = pathToSign.trim();
        const { data: signedData, error } = await supabaseClient.storage
          .from("upselling-images")
          .createSignedUrl(pathTrimmed, 3600);
        if (error) throw error;
        const signedUrl = signedData?.signedUrl ?? signedData?.signed_url;
        if (!signedUrl) throw new Error("Could not create signed URL");
        // Supabase devuelve URLs con host interno (ej. kong:8000); reemplazar por la URL base del cliente
        // para que funcione en local (http://127.0.0.1:54321) y en producción (https://xxx.supabase.co)
        const clientBase = (typeof body.baseUrl === "string" && body.baseUrl.trim())
          ? body.baseUrl.replace(/\/$/, "")
          : SUPABASE_URL.replace(/\/$/, "");
        const urlForClient = signedUrl.replace(/^https?:\/\/[^/]+/, clientBase);
        result = { data: { url: urlForClient } };
        break;
      }

      case "deleteImage": {
        const { publicUrl } = body;
        if (!publicUrl || typeof publicUrl !== "string") {
          throw new Error("deleteImage requires publicUrl");
        }
        const bucketPrefix = "/upselling-images/";
        const i = publicUrl.indexOf(bucketPrefix);
        if (i === -1) {
          result = { data: { deleted: false } };
          break;
        }
        const path = publicUrl.slice(i + bucketPrefix.length).replace(/^\//, "").split("?")[0];
        const pathTrimmed = path.trim();
        if (!pathTrimmed) {
          result = { data: { deleted: false } };
          break;
        }
        const { error } = await supabaseClient.storage
          .from("upselling-images")
          .remove([pathTrimmed]);
        if (error) throw error;
        result = { data: { deleted: true } };
        break;
      }

      case "getByEventId": {
        const { data: rows, error } = await supabaseClient
          .from("upsellings")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        const upsellings = (rows || []).map((u: Record<string, unknown>) => ({
          ...u,
          images: Array.isArray(u?.images) ? u.images : [],
        }));
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
        const insertPayload = {
          ...data,
          images: Array.isArray(data?.images) ? data.images : [],
        };
        const { data: upselling, error } = await supabaseClient
          .from("upsellings")
          .insert(insertPayload)
          .select()
          .single();

        if (error) throw error;
        result = { data: upselling };
        break;
      }

      case "update": {
        const imagesValue = Array.isArray(data?.images) ? data.images : [];
        const updatePayload = {
          ...data,
          images: imagesValue,
          updated_at: new Date().toISOString(),
        };
        delete updatePayload.event_id;
        const { data: upselling, error } = await supabaseClient
          .from("upsellings")
          .update(updatePayload)
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
