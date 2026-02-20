/* eslint-disable */
// @ts-nocheck

/**
 * Customer.io Transactional Email Service
 * Sends transactional emails via Customer.io Track API
 */

export interface CustomerIOConfig {
  appApiKey: string;
  transactionalTemplateId: string;
}

export interface CustomerIOTrackConfig {
  siteId: string;
  trackApiKey: string;
}

export interface OrderEmailData {
  name: string;
  email: string;
  orderId: string;
  purchasedAt: string;
}

export interface CustomerAttributes {
  [key: string]: any;
}

export interface CustomerIOResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Send a transactional email via Customer.io
 * @param config Customer.io configuration (App API Key, Template ID)
 * @param orderData Order data to include in the email
 * @returns Promise with success status and message
 */
export async function sendTransactionalEmail(
  config: CustomerIOConfig,
  orderData: OrderEmailData
): Promise<CustomerIOResponse> {
  // Validate configuration
  if (!config.appApiKey || !config.transactionalTemplateId) {
    return {
      success: false,
      error: "Customer.io configuration incomplete. Missing App API Key or Template ID.",
    };
  }

  // Validate order data
  if (!orderData.email || !orderData.orderId) {
    return {
      success: false,
      error: "Order data incomplete. Email and Order ID are required.",
    };
  }

  try {
    // Prepare the payload for Customer.io Transactional API
    // message_data = full trigger data (order_items, order_total, custom_fields, etc.) for template variables
    const payload = {
      transactional_message_id: config.transactionalTemplateId,
      to: orderData.email,
      identifiers: {
        email: orderData.email,
      },
      message_data: typeof orderData === "object" && orderData !== null
        ? { ...orderData }
        : {
            name: orderData.name,
            email: orderData.email,
            orderId: orderData.orderId,
            purchasedAt: orderData.purchasedAt,
          },
    };

    // Make the API request to Customer.io using App API Key with Bearer auth
    const response = await fetch("https://api.customer.io/v1/send/email", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.appApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Customer.io API error (${response.status}):`, errorText);
      return {
        success: false,
        error: `Customer.io API returned ${response.status}: ${errorText}`,
      };
    }

    // Parse the response
    const result = await response.json();
    
    return {
      success: true,
      message: "Transactional email sent successfully",
    };
  } catch (error: any) {
    console.error("Customer.io email send error:", error);
    return {
      success: false,
      error: `Failed to send email: ${error.message}`,
    };
  }
}

/**
 * Identify a customer in Customer.io using Track API
 * @param config Customer.io Track API configuration (Site ID, Track API Key)
 * @param email Customer email address (used as identifier)
 * @param attributes Customer attributes to set or update
 * @returns Promise with success status and message
 */
export async function identifyCustomer(
  config: CustomerIOTrackConfig,
  email: string,
  attributes: CustomerAttributes
): Promise<CustomerIOResponse> {
  // Validate configuration
  if (!config.siteId || !config.trackApiKey) {
    return {
      success: false,
      error: "Customer.io Track API configuration incomplete. Missing Site ID or Track API Key.",
    };
  }

  // Validate email
  if (!email) {
    return {
      success: false,
      error: "Customer email is required for identify call.",
    };
  }

  try {
    // Encode credentials for Basic Auth
    const credentials = btoa(`${config.siteId}:${config.trackApiKey}`);

    // Prepare the payload for Customer.io Track API
    const payload = {
      email: email,
      ...attributes,
    };

    // Make the API request to Customer.io Track API
    const response = await fetch(`https://track.customer.io/api/v1/customers/${encodeURIComponent(email)}`, {
      method: "PUT",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Check if the request was successful (Track API returns 200 for success)
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Customer.io Track API error (${response.status}):`, errorText);
      return {
        success: false,
        error: `Customer.io Track API returned ${response.status}: ${errorText}`,
      };
    }

    return {
      success: true,
      message: "Customer identified successfully in Customer.io",
    };
  } catch (error: any) {
    console.error("Customer.io identify error:", error);
    return {
      success: false,
      error: `Failed to identify customer: ${error.message}`,
    };
  }
}

