/* eslint-disable */
// @ts-nocheck

/**
 * Sends a Slack notification when a new order is created
 *
 * @param webhookUrl - The Slack webhook URL from the event configuration
 * @param orderData - The order data including event and order items
 * @returns Promise with success status
 */
export async function sendSlackNotification(
  webhookUrl: string,
  orderData: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!webhookUrl) {
      return {
        success: false,
        error: "Slack webhook URL is not configured",
      };
    }

    const event = orderData.events || {};
    const orderItems = orderData.order_items || [];

    // Build order items summary
    const itemsSummary = orderItems
      .map((item: any) => {
        const ticketName = item.ticket_types?.name || "Unknown Ticket";
        return `• ${ticketName}: ${item.quantity} × $${parseFloat(
          item.unit_price,
        ).toFixed(2)} = $${parseFloat(item.subtotal).toFixed(2)}`;
      })
      .join("\n");

    const totalTickets = orderItems.reduce(
      (sum: number, item: any) => sum + (item.quantity || 0),
      0,
    );

    // Format the Slack message with rich formatting
    const slackMessage = {
      text: `🎫 New Order: ${event.title || "Unknown Event"}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🎫 New Order: ${event.title || "Unknown Event"}`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Order ID:*\n${orderData.id}`,
            },
            {
              type: "mrkdwn",
              text: `*Status:*\n${orderData.status || "PENDING"}`,
            },
            {
              type: "mrkdwn",
              text: `*Customer:*\n${
                orderData.customer_name || orderData.customer_email || "N/A"
              }`,
            },
            {
              type: "mrkdwn",
              text: `*Email:*\n${orderData.customer_email || "N/A"}`,
            },
            {
              type: "mrkdwn",
              text: `*Total Tickets:*\n${totalTickets}`,
            },
            {
              type: "mrkdwn",
              text: `*Order Total:*\n$${parseFloat(
                orderData.total || 0,
              ).toFixed(2)}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Order Items:*\n\`\`\`${itemsSummary}\`\`\``,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Subtotal:*\n$${parseFloat(
                orderData.subtotal || 0,
              ).toFixed(2)}`,
            },
            orderData.discount_amount &&
            parseFloat(orderData.discount_amount) > 0
              ? {
                  type: "mrkdwn",
                  text: `*Discount:*\n-$${parseFloat(
                    orderData.discount_amount,
                  ).toFixed(2)}`,
                }
              : null,
            {
              type: "mrkdwn",
              text: `*Total:*\n$${parseFloat(orderData.total || 0).toFixed(2)}`,
            },
          ].filter(Boolean),
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Order created at ${new Date(
                orderData.created_at,
              ).toLocaleString()}`,
            },
          ],
        },
      ],
    };

    // Send the webhook request
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Slack webhook request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error sending Slack notification:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
