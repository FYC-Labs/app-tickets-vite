import { Signal } from '@fyclabs/tools-fyc-react/signals';

export const $global = Signal({
  isLoading: true,
  isSignedIn: false,
});
export const $view = Signal({});
export const $auth = Signal({});
export const $user = Signal({});
export const $list = Signal({});
export const $detail = Signal({});
export const $form = Signal({});
export const $filter = Signal({ page: 1 });
export const $alert = Signal({});

// Admin specific signals
export const $events = Signal({
  list: [],
  current: null,
});
export const $tickets = Signal({
  list: [],
});
export const $upsellings = Signal({
  list: [],
});
export const $discounts = Signal({
  list: [],
});
export const $forms = Signal({
  list: [],
});
export const $dashboard = Signal({
  stats: {
    events: 0,
    forms: 0,
    orders: 0,
    revenue: 0,
  },
});
export const $embed = Signal({
  form: null,
  tickets: [],
  upsellings: [],
  formData: {},
  selectedTickets: {},
  selectedUpsellings: {},
  upsellingCustomFields: {}, // { [upsellingId]: [ { [fieldLabel]: value }, ... ] } per-unit when custom_fields
  discountCode: '',
  appliedDiscount: null,
  totals: { subtotal: 0, discount_amount: 0, total: 0 },
  error: null,
  isFormValid: false,
  order: null,
  paymentSession: null,
});
export const $checkout = Signal({
  order: null,
  form: null,
  paymentSession: null,
  error: null,
  paymentStatus: null,
});
