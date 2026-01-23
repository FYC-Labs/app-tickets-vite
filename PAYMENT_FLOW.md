# Complete Payment Flow - Workglue Ticketing System

This document describes in detail the complete payment flow from frontend to backend, including all database actions, discount handling, and external integrations.

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Frontend Flow - Event Form](#frontend-flow---event-form)
3. [Frontend Flow - Checkout](#frontend-flow---checkout)
4. [Backend Flow - Order Creation](#backend-flow---order-creation)
5. [Backend Flow - Payment Session](#backend-flow---payment-session)
6. [Backend Flow - Payment Confirmation](#backend-flow---payment-confirmation)
7. [Special Flow - Free Orders (100% Discount)](#special-flow---free-orders-100-discount)
8. [Database Actions](#database-actions)
9. [External Integrations](#external-integrations)
10. [Flow Diagram](#flow-diagram)

---

## Executive Summary

The payment system works in the following main stages:

1. **Event Form** → User completes form and selects tickets
2. **Discount Application** → User can apply discount code (optional)
3. **Order Creation** → Order is created in `PENDING` status with items and discount
4. **Payment Session** → Session is initialized with AccruPay/Nuvei (only if total > 0)
5. **Payment Processing** → User enters card data and processes payment
6. **Confirmation** → Payment is verified, inventory updated, notifications sent
7. **Redirect** → User is redirected to confirmation page

---

## Frontend Flow - Event Form

### Component: `EventForm.jsx`

**Location:** `src/components/embed/EventForm.jsx`

#### 1. Initial Data Load

**Function:** `loadFormData(formId, eventId)`
- **File:** `src/components/embed/_helpers/eventForm.events.js:8-55`
- **Actions:**
  - Loads form data from `formsAPI.getById(formId)`
  - Loads available tickets for the event
  - Filters tickets by:
    - `available_ticket_ids` (if form has specific tickets)
    - Sale date (`sales_start` <= now <= `sales_end`)
    - Availability (`quantity - sold > 0`)
  - Stores everything in `$embed` signal

#### 2. Ticket Selection

**Function:** `handleTicketChange(ticketId, quantity)`
- **File:** `src/components/embed/_helpers/eventForm.events.js:98-104`
- **Actions:**
  - Updates `selectedTickets` in `$embed` signal
  - Calls `calculateTotals()` to recalculate subtotal
  - Validates form with `checkFormValidity()`

#### 3. Discount Application

**Function:** `handleApplyDiscount(formId, eventId)`
- **File:** `src/components/embed/_helpers/eventForm.events.js:106-130`
- **Flow:**
  1. User enters discount code
  2. Calls `discountsAPI.validateCode(discountCode, eventId)`
  3. Backend validates:
     - Code exists and belongs to event
     - Has not expired (`expires_at`)
     - Has not reached `max_uses` (if configured)
     - Is active (`is_active = true`)
  4. If valid, saves to `appliedDiscount` in signal
  5. Recalculates total with `calculateTotals()`

**Discount Calculation:**
```javascript
// In calculateTotals() - lines 70-77
if (appliedDiscount.type === 'PERCENT') {
  discountAmount = (subtotal * parseFloat(appliedDiscount.value)) / 100;
} else {
  discountAmount = parseFloat(appliedDiscount.value); // AMOUNT
}
total = Math.max(0, subtotal - discountAmount);
```

#### 4. Form Validation

**Function:** `checkFormValidity()`
- **File:** `src/components/embed/_helpers/eventForm.events.js:164-209`
- **Validations:**
  - Email required and valid format
  - Name required
  - Required form schema fields
  - Phone (if type 'tel') must have USA format (10 digits)
  - At least one ticket selected (if tickets available)

#### 5. Form Submission

**Function:** `handleSubmit(e, formId, eventId, onSubmitSuccess)`
- **File:** `src/components/embed/_helpers/eventForm.events.js:211-272`
- **Complete Flow:**

```javascript
1. Prevent default submit
2. Validate form with validateForm()
3. If errors, show and stop
4. Start loading

5. If form exists:
   - Call formsAPI.submitForm(form.id, formData, formData.email)
   - This creates record in form_submissions
   - Save submissionId

6. If tickets selected:
   - Build orderItems array:
     [
       {
         ticket_type_id: "uuid",
         quantity: 2,
         unit_price: 50.00
       }
     ]
   
   - Build orderData:
     {
       event_id: "uuid",
       form_submission_id: submissionId,
       discount_code_id: appliedDiscount?.id || null,
       subtotal: 100.00,
       discount_amount: 20.00,
       total: 80.00,
       status: 'PENDING',
       customer_email: "user@example.com",
       customer_name: "John Doe",
       items: orderItems
     }
   
   - Call ordersAPI.create(orderData)
   - This creates order in PENDING status

7. If onSubmitSuccess callback exists:
   - Call with { order, submission: submissionId }
   - Usually redirects to /embed/checkout/{orderId}
```

---

## Frontend Flow - Checkout

### Component: `Checkout.jsx`

**Location:** `src/components/embed/Checkout.jsx`

#### 1. Order Data Load

**Function:** `loadOrderData(orderId)`
- **File:** `src/components/embed/_helpers/checkout.resolvers.js:6-85`
- **Flow:**

```javascript
1. Call ordersAPI.getById(orderId)
   - Backend: supabase/functions/orders/index.ts (case "getById")
   - Returns order with relationships:
     * events
     * order_items (with ticket_types)
     * discount_codes
     * form_submissions (if exists)

2. Validate order status:
   - If status === 'PAID' → Show "Already paid" message
   - If status === 'CANCELLED' → Error
   - If status === 'EXPIRED' → Error
   - If status !== 'PENDING' → Error

3. **SPECIAL CASE: Free Order (total === 0)**
   - If parseFloat(order.total) === 0:
     * Call paymentsAPI.confirmFreePayment(orderId)
     * This marks order as PAID automatically
     * Reload order data
     * Show "completed" status
     * DO NOT initialize payment session

4. If order is valid and total > 0:
   - Save to $checkout signal
   - Continue with payment session initialization
```

#### 2. Payment Session Initialization

**Function:** `initializePaymentSession(orderId)`
- **File:** `src/components/embed/_helpers/checkout.resolvers.js:87-107`
- **Flow:**

```javascript
1. First tries to get existing session:
   - paymentsAPI.getPaymentSession(orderId)
   - If exists and has valid sessionToken, uses it

2. If no session exists:
   - Calls paymentsAPI.createPaymentSession(orderId)
   - Backend creates session with AccruPay
   - Returns:
     {
       sessionToken: "token...",
       transactionId: "id...",
       tokenExpiresAt: "timestamp",
       preSessionData: { ... }
     }

3. Saves session in $checkout signal
```

**Note:** Only initializes if `order.total > 0` and `order.status === 'PENDING'`

#### 3. Payment Form Rendering

**Component:** `CreditCardForm.jsx`
- **File:** `src/components/embed/_components/CreditCardForm.jsx`
- **AccruPay Components:**
  - `AccruPaymentForm.CardHolderName`
  - `AccruPaymentForm.CreditCardNumber`
  - `AccruPaymentForm.CreditCardExpiration`
  - `AccruPaymentForm.CreditCardCvc`
  - `AccruPaymentForm.SubmitBtn`

**Events:**
- `onSubmit` → Sets `isProcessingPayment = true`
- `onSuccess` → Calls `handlePaymentSuccess(paymentData)`
- `onError` → Calls `handlePaymentError(error)`

#### 4. Successful Payment Confirmation

**Function:** `handlePaymentSuccess(paymentData)`
- **File:** `src/components/embed/_helpers/checkout.events.js:43-131`
- **Flow:**

```javascript
1. Set isProcessingPayment = true
2. Call paymentsAPI.confirmPayment(order.id, paymentData)
   - Backend verifies payment with AccruPay
   - Updates order to status = 'PAID'
   - Updates ticket inventory
   - Sends notifications

3. Build confirmation URL:
   - Priority 1: confirmationUrlOverride (query param)
   - Priority 2: form.order_confirmation_url
   - Fallback: /embed/order-confirmation/{orderId}

4. Add order data as query params:
   - orderId, customerEmail, total, status, etc.

5. If in iframe (embed):
   - Send postMessage to parent window
   - Type: 'order-complete'
   - Include redirectUrl and orderDetails

6. If not in iframe:
   - Update paymentStatus = 'completed'
   - Redirect after 2 seconds
```

---

## Backend Flow - Order Creation

### Edge Function: `orders/index.ts`

**Action:** `create`
**File:** `supabase/functions/orders/index.ts:182-300`

#### Step 1: Data Preparation

```typescript
1. Extract items from orderData
2. Determine payment_environment:
   - If event.accrupay_environment exists → use that
   - If not → use ENV_TAG (dev = sandbox, prod = production)
3. Get slack_webhook_url from event
```

#### Step 2: Create Order in Database

```sql
INSERT INTO orders (
  event_id,
  form_submission_id,
  discount_code_id,
  subtotal,
  discount_amount,
  total,
  status,                    -- 'PENDING'
  payment_environment,
  customer_email,
  customer_name,
  ...
)
VALUES (...)
```

**Affected table:** `orders`

#### Step 3: Create Order Items

```sql
INSERT INTO order_items (
  order_id,
  ticket_type_id,
  quantity,
  unit_price,
  subtotal
)
VALUES 
  (orderId, ticketId1, 2, 50.00, 100.00),
  (orderId, ticketId2, 1, 30.00, 30.00)
```

**Affected table:** `order_items`

**Note:** Each item's `subtotal` is calculated as `quantity * unit_price`

#### Step 4: Connect Form Submission with Order

```typescript
If order.form_submission_id exists:
  UPDATE form_submissions
  SET order_id = {newOrder.id}
  WHERE id = {form_submission_id}
```

**Affected table:** `form_submissions`
**Updated field:** `order_id`

**Reason:** Establishes bidirectional relationship between order and submission

#### Step 5: Customer.io Synchronization

```typescript
syncOrderStatusToCustomerIO(createdOrder.id, supabaseClient)
```

**Function:** `supabase/functions/orders/services/syncOrderStatusToCustomerIO.ts`

**Actions:**
1. Gets order data with:
   - Event information
   - Order items
   - Form submissions (to get responses)
2. Extracts from `form_submissions.responses`:
   - `phone_number` → used as `phone` in Customer.io
   - `preferred_channel` → sent as custom attribute
3. Builds attributes for Customer.io:
   ```javascript
   {
     name, first_name, last_name,
     phone,                    // Prioritizes phone_number from form
     preferred_channel,        // "sms" or "email"
     billing_address, billing_city, ...
     order_id, order_total, order_status,
     event_title, event_location, ...
     order_items: [...],
     form_responses: {...}
   }
   ```
4. Calls `identifyCustomer()` with these attributes
5. Customer.io creates/updates customer profile

#### Step 6: Slack Notification (Optional)

```typescript
If event.slack_webhook_url exists:
  sendSlackNotification(webhookUrl, createdOrder)
```

**Function:** `supabase/functions/orders/services/sendSlackNotification.ts`

**Slack Payload:**
- Order information
- Customer
- Items
- Total

---

## Backend Flow - Payment Session

### Edge Function: `payments/index.ts`

**Action:** `createPaymentSession`
**File:** `supabase/functions/payments/services/createPaymentSession.ts`

#### Step 1: Get Order Data

```typescript
SELECT 
  id, event_id, total, status, customer_email, ...
  events(accrupay_environment),
  order_items(ticket_types(name))
FROM orders
WHERE id = orderId
```

**Validations:**
- Order must exist
- Status must be `PENDING`

#### Step 2: Select AccruPay Client

```typescript
selectAccruPayClient(clients, event.accrupay_environment, envTag)
```

**Logic:**
- If `event.accrupay_environment === "production"` → use production client
- If `event.accrupay_environment === "sandbox"` → use sandbox client
- If not configured → use `ENV_TAG`:
  - `ENV_TAG === "prod"` → production
  - `ENV_TAG === "dev"` → sandbox

**Available clients:**
- `clients.production` → uses `ACCRUPAY_SECRET_KEY`
- `clients.sandbox` → uses `ACCRUPAY_SECRET_KEY_QA`

#### Step 3: Create Session with AccruPay

```typescript
const sessionData = {
  transactionProvider: TRANSACTION_PROVIDER.NUVEI,
  data: {
    amount: BigInt(amountInCents),  // total * 100
    currency: CURRENCY.USD,
    billing: {
      billingFirstName: order.customer_first_name,
      billingLastName: order.customer_last_name,
      billingEmail: order.customer_email,
      billingPhone: order.customer_phone,
      billingAddressCountry: COUNTRY_ISO_2.US,
      billingAddressState: order.billing_state,
      billingAddressCity: order.billing_city,
      billingAddressLine1: order.billing_address,
      billingAddressLine2: order.billing_address_2,
      billingAddressPostalCode: order.billing_zip,
    },
    storePaymentMethod: false,
    merchantInternalCustomerCode: order.customer_email,
    merchantInternalTransactionCode: order.id,
  },
};

const transaction = await accruPay.transactions.startClientPaymentSession(sessionData);
```

**AccruPay API:** `POST https://api.accrupay.com/graphql`

#### Step 4: Get Pre-Session Data

```typescript
const preSessionData = await accruPay.transactions.getClientPaymentPreSessionData({
  transactionProvider: TRANSACTION_PROVIDER.NUVEI,
});
```

**Usage:** Data needed to initialize AccruPay React SDK

#### Step 5: Save Session in Database

```sql
UPDATE orders
SET 
  payment_session_id = {transaction.token},
  payment_provider = 'nuvei',
  payment_intent_id = {transaction.id},
  updated_at = NOW()
WHERE id = {orderId}
```

**Affected table:** `orders`
**Updated fields:**
- `payment_session_id` → Session token
- `payment_provider` → "nuvei"
- `payment_intent_id` → Transaction ID in AccruPay

#### Step 6: Return Data to Frontend

```typescript
return {
  data: {
    sessionToken: transaction.token,
    transactionId: transaction.id,
    tokenExpiresAt: transaction.tokenExpiresAt,
    preSessionData: preSessionData,
  },
};
```

---

## Backend Flow - Payment Confirmation

### Edge Function: `payments/index.ts`

**Action:** `confirmPayment`
**File:** `supabase/functions/payments/services/confirmPayment.ts:555-643`

#### Step 1: Get Order Details

```typescript
const order = await getOrderDetails(orderId, supabaseClient);
```

**Query:**
```sql
SELECT 
  id, status, payment_intent_id, payment_session_id,
  customer_email, event_id,
  events(accrupay_environment, slack_webhook_url)
FROM orders
WHERE id = orderId
```

#### Step 2: Select AccruPay Client

```typescript
const accruPay = selectAccruPayClient(
  accruPayClients,
  order.events?.accrupay_environment || null,
  envTag
);
```

**Same logic as in createPaymentSession**

#### Step 3: Verify Transaction with AccruPay

```typescript
const verifiedTransaction = await verifyPaymentTransaction(
  order,
  accruPay,
  envTag
);
```

**Function:** `verifyPaymentTransaction()` - lines 65-80

**Logic:**
- If `envTag === "prod"` → Returns success automatically (bypass for production)
- If not → Calls `accruPay.transactions.verifyClientPaymentSession()`

**AccruPay API:** Verifies that transaction was processed successfully

**Validation:**
- If `verifiedTransaction.status !== "SUCCEEDED"` → Throws error

#### Step 4: Update Order Status to PAID

```typescript
await updateOrderStatus(orderId, "PAID", verifiedTransaction.id, supabaseClient);
```

**Function:** `updateOrderStatus()` - lines 85-106

**SQL:**
```sql
UPDATE orders
SET 
  status = 'PAID',
  payment_intent_id = {verifiedTransaction.id},
  updated_at = NOW()
WHERE id = {orderId}
```

**Affected table:** `orders`
**Updated fields:**
- `status` → 'PAID'
- `payment_intent_id` → Verified transaction ID
- `updated_at` → Current timestamp

#### Step 5: Update Ticket Inventory

```typescript
const orderItems = await updateTicketInventory(orderId, supabaseClient);
```

**Function:** `updateTicketInventory()` - lines 111-127

**Flow:**
1. Get all `order_items` for the order:
   ```sql
   SELECT ticket_type_id, quantity
   FROM order_items
   WHERE order_id = {orderId}
   ```

2. For each item, increment `sold`:
   ```sql
   SELECT increment_ticket_sold(
     ticket_id := {ticket_type_id},
     amount := {quantity}
   )
   ```

**SQL Function:** `increment_ticket_sold()` (defined in migrations)

**Function logic:**
```sql
UPDATE ticket_types
SET sold = sold + amount
WHERE id = ticket_id
AND (sold + amount) <= quantity  -- Inventory validation
RETURNING sold;
```

**Affected table:** `ticket_types`
**Updated field:** `sold` (incremented)

**Validation:** Does not allow selling more tickets than available

#### Step 6: Slack Notification (Optional)

```typescript
if (order.events?.slack_webhook_url) {
  const fullOrder = await getFullOrderData(orderId);
  sendSlackNotification(webhookUrl, fullOrder);
}
```

**Payload:** Complete information of paid order

#### Step 7: Email Sending and Customer.io Synchronization

```typescript
const triggerData = await sendConfirmationEmail(
  orderId,
  orderItems,
  supabaseClient
);
```

**Function:** `sendConfirmationEmail()` - lines 362-447

**Sub-steps:**

**7.1. Get Complete Data:**
```typescript
const eventData = await getEventAndOrderData(orderId, supabaseClient);
```
- Gets order with event
- Gets `form_submissions` (by `form_submission_id` or `order_id`)
- Extracts `responses` from form

**7.2. Send Transactional Email (if configured):**
```typescript
if (event.customerio_app_api_key && event.customerio_transactional_template_id) {
  const triggerData = buildEmailTriggerData(eventData, orderItems, orderId);
  await sendTransactionalEmail(config, triggerData);
}
```

**Customer.io API:** `POST https://api.customer.io/v1/send/email`

**Payload:**
```json
{
  "transactional_message_id": "{template_id}",
  "to": "{customer_email}",
  "identifiers": {
    "email": "{customer_email}"
  },
  "message_data": {
    "name": "{customer_name}",
    "email": "{customer_email}",
    "orderId": "{order_id}",
    "purchasedAt": "{date}"
  }
}
```

**7.3. Identify Customer in Customer.io (if configured):**
```typescript
if (event.customerio_site_id && event.customerio_track_api_key) {
  const customerAttributes = buildCustomerAttributes(eventData, orderItems, orderId);
  await identifyCustomer(config, customerEmail, customerAttributes);
}
```

**Customer.io API:** `PUT https://track.customer.io/api/v1/customers/{email}`

**Sent attributes:**
```javascript
{
  name, first_name, last_name,
  phone,                    // Prioritizes phone_number from form
  preferred_channel,        // "sms" or "email" (from form responses)
  billing_address, billing_city, billing_state, billing_zip,
  order_id, order_total, order_subtotal, order_discount_amount,
  order_status: "PAID",
  payment_intent_id,
  order_created_at,
  event_title, event_start_date, event_end_date, event_location,
  order_items: [
    {
      ticketTypeName: "...",
      quantity: 2,
      unitPrice: 50.00,
      subtotal: 100.00
    }
  ],
  total_tickets: 2,
  form_responses: { ... }  // All form responses
}
```

**Note:** The `phone` and `preferred_channel` attributes are extracted from `form_submissions.responses`:
- `phone_number` → used as `phone`
- `preferred_channel` → sent as custom attribute

#### Step 8: Return Result

```typescript
return {
  data: {
    status: "success",
    orderId: orderId,
    triggerData: triggerData,
  },
};
```

---

## Special Flow - Free Orders (100% Discount)

### Case: `order.total === 0`

This occurs when a 100% discount is applied (`discount_codes.type === "PERCENT"` and `discount_codes.value === 100`).

### Frontend: `Checkout.jsx`

**Detection:** `checkout.resolvers.js:38-56`

```javascript
const orderTotal = parseFloat(orderData.total) || 0;
const isFreeOrder = orderTotal === 0;

if (isFreeOrder) {
  // Automatically confirm payment without processing card
  await paymentsAPI.confirmFreePayment(orderId);
  // Reload order (now status = 'PAID')
  const updatedOrderData = await ordersAPI.getById(orderId);
  // Show completed status
  $checkout.update({
    order: updatedOrderData,
    paymentStatus: 'completed',
  });
}
```

**UI:**
- Payment form is NOT shown
- Shows message: "No Payment Required - Your order has a 100% discount applied"
- Payment session is NOT initialized

### Backend: `confirmFreePayment()`

**File:** `supabase/functions/payments/services/confirmPayment.ts:479-550`

**Flow:**

```typescript
1. Get basic order data:
   SELECT id, event_id, events(slack_webhook_url)
   FROM orders
   WHERE id = orderId

2. Update order to PAID:
   UPDATE orders
   SET status = 'PAID', updated_at = NOW()
   WHERE id = orderId
   
   ⚠️ payment_intent_id is NOT updated (remains null)

3. Update ticket inventory:
   - Same process as normal confirmPayment
   - Calls increment_ticket_sold() for each item

4. Slack notification (if configured):
   - Same process as normal confirmPayment

5. Email and Customer.io sending:
   - Same process as normal confirmPayment
   - Confirmation email is sent
   - Synchronizes with Customer.io

6. Return success
```

**Differences from normal payment:**
- ❌ Does NOT verify transaction with AccruPay
- ❌ Does NOT update `payment_intent_id`
- ✅ Updates inventory
- ✅ Sends notifications
- ✅ Synchronizes with Customer.io

---

## Database Actions

### Table: `orders`

#### Order Creation
```sql
INSERT INTO orders (
  id, event_id, form_submission_id, discount_code_id,
  subtotal, discount_amount, total,
  status,                    -- 'PENDING'
  payment_environment,       -- 'production' | 'sandbox'
  customer_email, customer_name,
  created_at, updated_at
)
```

#### Update When Creating Payment Session
```sql
UPDATE orders
SET 
  payment_session_id = {sessionToken},
  payment_provider = 'nuvei',
  payment_intent_id = {transactionId},
  updated_at = NOW()
WHERE id = {orderId}
```

#### Update When Confirming Payment
```sql
UPDATE orders
SET 
  status = 'PAID',
  payment_intent_id = {verifiedTransactionId},  -- Only if real payment
  updated_at = NOW()
WHERE id = {orderId}
```

**Note:** In free orders, `payment_intent_id` remains `NULL`

### Table: `order_items`

#### Item Creation
```sql
INSERT INTO order_items (
  id, order_id, ticket_type_id,
  quantity, unit_price, subtotal,
  created_at
)
VALUES 
  ({id1}, {orderId}, {ticketId1}, 2, 50.00, 100.00, NOW()),
  ({id2}, {orderId}, {ticketId2}, 1, 30.00, 30.00, NOW())
```

**Calculation:** `subtotal = quantity * unit_price`

### Table: `form_submissions`

#### Submission Creation
```sql
INSERT INTO form_submissions (
  id, form_id, responses, email, created_at
)
VALUES (
  {id}, {formId}, {responses_jsonb}, {email}, NOW()
)
```

**`responses` field:** JSONB with all form responses
- Example: `{"phone_number": "(123) 456-7890", "preferred_channel": "sms", ...}`

#### Connection with Order
```sql
UPDATE form_submissions
SET order_id = {orderId}
WHERE id = {form_submission_id}
```

**Reason:** Establishes bidirectional relationship

### Table: `ticket_types`

#### Inventory Update
```sql
-- Function: increment_ticket_sold(ticket_id, amount)
UPDATE ticket_types
SET sold = sold + amount
WHERE id = ticket_id
AND (sold + amount) <= quantity  -- Validation
RETURNING sold;
```

**Validation:** Does not allow selling more than available

**Example:**
- Ticket has `quantity = 100`, `sold = 95`
- Order buys `quantity = 2`
- Result: `sold = 97` ✅
- If tries to buy `quantity = 10`: Error (97 + 10 = 107 > 100) ❌

### Table: `discount_codes`

#### Code Validation
```sql
SELECT id, code, type, value, max_uses, used_count, expires_at, is_active
FROM discount_codes
WHERE code = {discountCode}
AND event_id = {eventId}
AND is_active = true
AND (expires_at IS NULL OR expires_at > NOW())
AND (max_uses IS NULL OR used_count < max_uses)
```

**Validations:**
- Code exists
- Belongs to event
- Is active
- Has not expired
- Has not reached maximum uses

**Note:** `used_count` is NOT automatically incremented when creating order. Must be incremented manually if tracking is required.

---

## External Integrations

### 1. AccruPay / Nuvei

**Purpose:** Credit card payment processing

**Endpoints:**
- **Create Session:** `accruPay.transactions.startClientPaymentSession()`
- **Verify Payment:** `accruPay.transactions.verifyClientPaymentSession()`
- **Pre-Session Data:** `accruPay.transactions.getClientPaymentPreSessionData()`

**Configuration:**
- **Production:** `ACCRUPAY_SECRET_KEY` (Supabase secret)
- **Sandbox/QA:** `ACCRUPAY_SECRET_KEY_QA` (Supabase secret)
- **Environment:** Determined by `event.accrupay_environment` or `ENV_TAG`

**Flow:**
1. Frontend initializes SDK with `sessionToken`
2. User completes card form
3. SDK processes payment with Nuvei
4. Backend verifies transaction
5. If verification successful → order marked as PAID

### 2. Customer.io

**Purpose:** Transactional email and customer segmentation

#### A. Transactional Email

**Endpoint:** `POST https://api.customer.io/v1/send/email`

**Authentication:** Bearer Token (`customerio_app_api_key`)

**When sent:**
- After successful payment confirmation
- After free order confirmation

**Payload:**
```json
{
  "transactional_message_id": "{template_id}",
  "to": "{customer_email}",
  "identifiers": { "email": "{customer_email}" },
  "message_data": {
    "name": "{customer_name}",
    "email": "{customer_email}",
    "orderId": "{order_id}",
    "purchasedAt": "{date}"
  }
}
```

#### B. Customer Identification (Track API)

**Endpoint:** `PUT https://track.customer.io/api/v1/customers/{email}`

**Authentication:** Basic Auth (`siteId:trackApiKey`)

**When sent:**
1. When creating order (status PENDING) → `syncOrderStatusToCustomerIO()`
2. When confirming payment (status PAID) → `sendConfirmationEmail()`

**Sent attributes:**
- Customer information (name, email, phone, preferred_channel)
- Billing information
- Order details (total, subtotal, discount, status)
- Event details
- Order items
- Form responses (`form_responses`)

**Special fields:**
- `phone`: Prioritizes `phone_number` from `form_submissions.responses`, fallback to `customer_phone`
- `preferred_channel`: Extracted from `form_submissions.responses.preferred_channel` ("sms" or "email")

### 3. Slack

**Purpose:** New order notifications

**Endpoint:** Webhook URL configured in `events.slack_webhook_url`

**When sent:**
1. When creating order (status PENDING)
2. When confirming payment (status PAID)

**Payload:**
- Order information
- Customer
- Items
- Total
- Status

**Function:** `supabase/functions/orders/services/sendSlackNotification.ts`

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND - EventForm                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [User completes form]
                              │
                              ▼
                    [Selects tickets]
                              │
                              ▼
                    [Applies discount (optional)]
                              │
                              ▼
                    [Validates form]
                              │
                              ▼
                    [handleSubmit()]
                              │
                              ├─────────────────┐
                              ▼                 ▼
                    [submitForm()]    [createOrder()]
                    (form_submissions)   (orders + order_items)
                              │                 │
                              └────────┬────────┘
                                       ▼
                              [Redirect to Checkout]
                                       │
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND - Checkout                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [loadOrderData()]
                              │
                              ├─────────────────┐
                              ▼                 ▼
                    [total === 0?]      [total > 0?]
                              │                 │
                              ▼                 ▼
                    [confirmFreePayment]  [createPaymentSession]
                              │                 │
                              ▼                 ▼
                    [Order → PAID]    [AccruPay Session]
                              │                 │
                              │                 ▼
                              │         [CreditCardForm]
                              │                 │
                              │                 ▼
                              │         [User pays]
                              │                 │
                              │                 ▼
                              │         [confirmPayment]
                              │                 │
                              └────────┬────────┘
                                       ▼
                              [Order → PAID]
                                       │
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND - Processing                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [Verify payment with AccruPay]
                              │
                              ▼
                    [UPDATE orders SET status='PAID']
                              │
                              ▼
                    [UPDATE ticket_types SET sold+=quantity]
                              │
                              ├─────────────────┐
                              ▼                 ▼
                    [sendSlackNotification]  [sendConfirmationEmail]
                              │                 │
                              │                 ├──────────────┐
                              │                 ▼              ▼
                              │         [Email Customer.io]  [Identify Customer.io]
                              │                 │              │
                              └─────────────────┴──────────────┘
                                       ▼
                              [Return success]
                                       │
                              [Redirect to confirmation]
```

---

## Special Cases and Validations

### 1. 100% Discount

**Detection:**
- `discount_codes.type === "PERCENT"` and `discount_codes.value === 100`
- Result: `order.total === 0`

**Behavior:**
- ✅ Order is created normally
- ✅ Connected with `form_submissions`
- ✅ Synchronized with Customer.io (status PENDING)
- ❌ Payment session is NOT created
- ✅ Automatically confirmed as PAID
- ✅ Inventory updated
- ✅ Confirmation email sent
- ✅ Synchronized with Customer.io (status PAID)

### 2. Inventory Validation

**Before creating order:**
- Frontend filters available tickets: `quantity - sold > 0`
- Only shows tickets with availability

**When confirming payment:**
- Backend validates with `increment_ticket_sold()`
- If `sold + quantity > total` → Error
- Prevents race conditions

### 3. Error Handling

**Order creation fails:**
- Frontend shows error
- Order and submission are not created
- User can retry

**Payment session fails:**
- Frontend shows error
- Order remains in PENDING
- User can refresh to retry

**Payment confirmation fails:**
- Order remains in PENDING
- Frontend shows error
- User must contact support
- ⚠️ **Important:** If payment was processed but confirmation fails, money may be on hold

### 4. Bidirectional Relationship Order ↔ Form Submission

**When creating order:**
```sql
-- Order has form_submission_id
INSERT INTO orders (form_submission_id, ...)

-- Form submission is updated with order_id
UPDATE form_submissions SET order_id = {orderId}
WHERE id = {form_submission_id}
```

**Reason:** Allows querying from both directions:
- `orders.form_submission_id` → get submission from order
- `form_submissions.order_id` → get order from submission

---

## Summary of Affected Tables

### During Order Creation:
1. **`orders`** → INSERT (status: PENDING)
2. **`order_items`** → INSERT (one per ticket)
3. **`form_submissions`** → UPDATE (order_id)
4. **`ticket_types`** → NOT updated yet (inventory doesn't change until payment)

### During Payment Confirmation:
1. **`orders`** → UPDATE (status: PAID, payment_intent_id)
2. **`ticket_types`** → UPDATE (sold += quantity) via `increment_ticket_sold()`

### During Free Order:
1. **`orders`** → UPDATE (status: PAID, payment_intent_id: NULL)
2. **`ticket_types`** → UPDATE (sold += quantity) via `increment_ticket_sold()`

---

## Endpoints and APIs Used

### Frontend → Backend

**Orders API:**
- `POST /functions/v1/orders` → `action: "create"`
- `GET /functions/v1/orders` → `action: "getById"`

**Payments API:**
- `POST /functions/v1/payments` → `action: "createPaymentSession"`
- `POST /functions/v1/payments` → `action: "confirmPayment"`
- `POST /functions/v1/payments` → `action: "confirmFreePayment"`
- `GET /functions/v1/payments` → `action: "getPaymentSession"`

**Forms API:**
- `POST /functions/v1/forms` → `action: "submitForm"`

**Discounts API:**
- `POST /functions/v1/discounts` → `action: "validateCode"`

### Backend → External Services

**AccruPay:**
- GraphQL API → Create session, verify payment

**Customer.io:**
- `POST https://api.customer.io/v1/send/email` → Transactional email
- `PUT https://track.customer.io/api/v1/customers/{email}` → Identify customer

**Slack:**
- Webhook POST → Notifications

---

## Important Notes

1. **Inventory:** Tickets are NOT reserved when creating order. Inventory is only updated when payment is confirmed.

2. **Race Conditions:** The `increment_ticket_sold()` function validates that no more than available is sold, but does not lock the order. If two users buy the last ticket simultaneously, one will fail on confirmation.

3. **Free Orders:** Do not require payment processing, but follow the same confirmation flow (inventory, notifications, emails).

4. **Customer.io:** Synchronizes at two moments:
   - When creating order (status PENDING) → Identifies customers with incomplete purchases
   - When confirming payment (status PAID) → Updates with final status

5. **Form Submissions:** Form data is stored in `form_submissions.responses` as JSONB. Special fields like `phone_number` and `preferred_channel` are extracted from here for Customer.io.

---

## Complete Step-by-Step Flow

### Scenario 1: Normal Payment with Partial Discount

1. User completes form → `form_submissions` created
2. User selects 2 tickets at $50 each → Subtotal: $100
3. User applies 20% discount → Discount: $20, Total: $80
4. User submits form → Order created (PENDING, total: $80)
5. Redirect to `/embed/checkout/{orderId}`
6. Frontend loads order → Detects total > 0
7. Frontend creates payment session → AccruPay returns `sessionToken`
8. User completes card → SDK processes payment
9. Frontend confirms payment → Backend verifies with AccruPay
10. Backend updates order → Status: PAID
11. Backend updates inventory → `ticket_types.sold += 2`
12. Backend sends notifications → Slack, Customer.io, Email
13. Frontend redirects → Confirmation page

### Scenario 2: Free Order (100% Discount)

1. User completes form → `form_submissions` created
2. User selects 1 ticket at $100
3. User applies 100% discount → Discount: $100, Total: $0
4. User submits form → Order created (PENDING, total: $0)
5. Redirect to `/embed/checkout/{orderId}`
6. Frontend loads order → Detects total === 0
7. Frontend calls `confirmFreePayment()` automatically
8. Backend updates order → Status: PAID (without payment_intent_id)
9. Backend updates inventory → `ticket_types.sold += 1`
10. Backend sends notifications → Slack, Customer.io, Email
11. Frontend shows → "No Payment Required" message
12. User sees confirmation → No redirect needed

---

*Document generated on: 2026-01-21*
*Last update: Includes free order flow and Customer.io synchronization with form_responses*
