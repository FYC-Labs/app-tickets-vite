/* eslint-disable */
// @ts-nocheck

import { TRANSACTION_PROVIDER, CURRENCY, COUNTRY_ISO_2 } from "npm:@accrupay/node@0.15.1";

/** Nuvei requires 2-letter US state code. Maps full names / invalid values to valid code. */
const US_STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
function toNuveiStateCode(value: string | null | undefined, country: string): string {
  if (!value || typeof value !== "string") return country === "US" ? "CA" : "";
  const s = value.trim();
  if (s.length === 2 && /^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const mapped = US_STATE_CODES[s.toLowerCase()];
  return mapped ?? (country === "US" ? "CA" : s);
}

function selectAccruPayClient(
  clients: { production: any; sandbox: any },
  eventEnvironment: string | null,
  envTag: string,
): any {
  if (eventEnvironment === "production") {
    if (!clients.production) {
      console.warn(
        "[ACCRUPAY][chargeUpsellings] Production client requested but not available, falling back to sandbox",
      );
      return clients.sandbox;
    }
    return clients.production;
  }

  if (eventEnvironment === "sandbox") {
    return clients.sandbox;
  }

  const defaultEnv = envTag === "prod" ? "production" : "sandbox";
  return clients[defaultEnv] || clients.sandbox;
}

export async function chargeUpsellingsWithStoredMethod(
  orderId: string,
  items: any[],
  supabaseClient: any,
  accruPayClients: { production: any; sandbox: any },
  envTag: string,
) {
  if (!items || items.length === 0) {
    throw new Error("No upsellings provided");
  }

  // 1) Fetch order with paymentMethodId and event environment
  const { data: order, error: orderError } = await supabaseClient
    .from("orders")
    .select(
      `
      id,
      status,
      subtotal,
      discount_amount,
      total,
      customer_email,
      customer_first_name,
      customer_last_name,
      customer_phone,
      billing_address,
      billing_address_2,
      billing_city,
      billing_state,
      billing_zip,
      "paymentMethodId",
      event_id,
      events!inner(accrupay_environment, slack_webhook_url)
    `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "PAID") {
    throw new Error("Can only charge upsellings for paid orders");
  }

  if (!order.paymentMethodId) {
    throw new Error("Order does not have a stored payment method");
  }

  // 2) Calculate upsellings amount
  let newItemsSubtotal = 0;
  const normalizedItems = items.map((item: any) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const itemSubtotal = quantity * unitPrice;
    newItemsSubtotal += itemSubtotal;
    return {
      ...item,
      quantity,
      unit_price: unitPrice,
      subtotal: itemSubtotal,
    };
  });

  if (newItemsSubtotal <= 0) {
    throw new Error("Upsellings total must be greater than zero");
  }

  const amountInCents = Math.round(newItemsSubtotal * 100);

  // 3) Select AccruPay client based on event configuration
  const accruPay = selectAccruPayClient(
    accruPayClients,
    order.events?.accrupay_environment || null,
    envTag,
  );

  const selectedEnv = order.events?.accrupay_environment || "default";

  // 4) Charge using stored payment method (docs: sdk.transactions.payments.paymentMethod.charge)
  const merchantInternalTransactionCode = `${order.id}-upsell-${Date.now()}`;

  const paymentMethodCharge = accruPay?.transactions?.payments?.paymentMethod;
  if (!paymentMethodCharge?.charge) {
    throw new Error(
      "AccruPay charge API not available (transactions.payments.paymentMethod.charge). Check @accrupay/node@0.15.1 exports.",
    );
  }

  const country = COUNTRY_ISO_2.US;
  const chargePayload = {
    transactionProvider: TRANSACTION_PROVIDER.NUVEI,
    data: {
      amount: BigInt(amountInCents),
      currency: CURRENCY.USD,
      merchantCustomerPaymentMethodId: order.paymentMethodId,
      merchantInternalCustomerCode: order.customer_email,
      merchantInternalTransactionCode,
      billing: {
        billingEmail: order.customer_email,
        billingFirstName: order.customer_first_name || "Guest",
        billingLastName: order.customer_last_name || "User",
        billingAddressCountry: country,
        billingPhone: order.customer_phone ?? undefined,
        billingAddressState: toNuveiStateCode(order.billing_state, country),
        billingAddressCity: order.billing_city ?? undefined,
        billingAddressLine1: order.billing_address ?? undefined,
        billingAddressLine2: order.billing_address_2 ?? undefined,
        billingAddressPostalCode: order.billing_zip ?? undefined,
      },
    },
  };
  const chargeResult = await paymentMethodCharge.charge(chargePayload);

  // Normalize: SDK may return { id, status } or { data: { id, status } } or similar
  const charge =
    chargeResult?.data ?? chargeResult?.transaction ?? chargeResult ?? {};
  const status = charge.status ?? chargeResult?.status;
  const id = charge.id ?? chargeResult?.id;

  if (status !== "SUCCEEDED") {
    throw new Error(`Upsellings charge failed: ${status ?? "unknown"}`);
  }

  // 5) Insert new order_items (mirrors orders.addItemsToOrder)
  let insertedItemsSubtotal = 0;
  const orderItems = normalizedItems.map((item: any) => {
    insertedItemsSubtotal += item.subtotal;
    return {
      order_id: order.id,
      ticket_type_id: item.ticket_type_id || null,
      upselling_id: item.upselling_id || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      custom_fields: item.custom_fields ?? {},
    };
  });

  const { error: itemsError } = await supabaseClient
    .from("order_items")
    .insert(orderItems);

  if (itemsError) throw itemsError;

  // 6) Update order totals
  const newSubtotal = parseFloat(order.subtotal) + insertedItemsSubtotal;
  const newTotal = Math.max(
    0,
    newSubtotal - parseFloat(order.discount_amount || 0),
  );

  const { data: updatedOrder, error: updateError } = await supabaseClient
    .from("orders")
    .update({
      subtotal: newSubtotal.toFixed(2),
      total: newTotal.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .select(
      "*, events(title), order_items(*, ticket_types(name), upsellings(item)), discount_codes(code, type, value)",
    )
    .single();

  if (updateError) throw updateError;

  // 7) Update upsellings sold count (same as in addItemsToOrder)
  for (const item of normalizedItems) {
    if (item.upselling_id) {
      const { data: upselling } = await supabaseClient
        .from("upsellings")
        .select("quantity, sold")
        .eq("id", item.upselling_id)
        .maybeSingle();

      if (upselling && upselling.quantity !== null) {
        await supabaseClient
          .from("upsellings")
          .update({
            sold: (upselling.sold || 0) + item.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.upselling_id);
      }
    }
  }

  return {
    data: updatedOrder,
  };
}

