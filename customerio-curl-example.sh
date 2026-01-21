#!/bin/bash

# Customer.io Transactional Email API - Correct curl example
# Based on supabase/functions/payments/services/customerio.ts

# Replace these with your actual values
APP_API_KEY="45b46d253c3cac13e30ccab424f13c15"
TEMPLATE_ID="2"
CUSTOMER_EMAIL="ivan@fyclabs.com"
CUSTOMER_NAME="Ivan"
ORDER_ID="fa0a06f7-9f7b-419f-a498-a9d7b43a33d0"
PURCHASED_AT="2026-01-20 21:14:43.347+00"

# Correct payload structure (matches the code exactly)
curl -v https://api.customer.io/v1/send/email \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${APP_API_KEY}" \
  -d "{
    \"transactional_message_id\": \"${TEMPLATE_ID}\",
    \"to\": \"${CUSTOMER_EMAIL}\",
    \"identifiers\": {
      \"email\": \"${CUSTOMER_EMAIL}\"
    },
    \"message_data\": {
      \"name\": \"${CUSTOMER_NAME}\",
      \"email\": \"${CUSTOMER_EMAIL}\",
      \"orderId\": \"${ORDER_ID}\",
      \"purchasedAt\": \"${PURCHASED_AT}\"
    }
  }"

# Alternative: Using a variable (cleaner for complex JSON)
# request='{
#   "transactional_message_id": "2",
#   "to": "ivan@fyclabs.com",
#   "identifiers": {
#     "email": "ivan@fyclabs.com"
#   },
#   "message_data": {
#     "name": "Ivan",
#     "email": "ivan@fyclabs.com",
#     "orderId": "fa0a06f7-9f7b-419f-a498-a9d7b43a33d0",
#     "purchasedAt": "2026-01-20 21:14:43.347+00"
#   }
# }'
#
# echo "$request" | curl -v https://api.customer.io/v1/send/email \
#   -H 'Content-Type: application/json' \
#   -H 'Authorization: Bearer 45b46d253c3cac13e30ccab424f13c15' \
#   -d @-
