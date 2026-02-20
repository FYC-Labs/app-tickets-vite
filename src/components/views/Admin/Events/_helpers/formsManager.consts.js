import { Signal } from '@fyclabs/tools-fyc-react/signals';

// Signals for table filtering and pagination
export const $formsFilter = Signal({
  page: 1,
  sortKey: undefined,
  sortDirection: undefined,
});

// Signals for table UI state
export const $formsView = Signal({
  isTableLoading: false,
  selectedItems: [],
  isSelectAllChecked: false,
});

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'tel', label: 'Phone' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'date', label: 'Date' },
];
