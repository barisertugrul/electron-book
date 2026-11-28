// labels.js — Everything in the app that depends on language: texts,
// currency, CSV format and the categories created on first launch.
//
// Both the main process and the renderer use this file. In the book's
// Turkish edition only the contents of this file differ.

export const APP_NAME = 'Budget Tracker';
export const LOCALE = 'en-US';
export const CURRENCY = 'USD';

// Decimal separator when typing an amount: a dot in English (1,250.50).
export const DECIMAL_SEPARATOR = '.';

export const TYPE_LABELS = { income: 'Income', expense: 'Expense' };

// Categories created on first launch.
export const DEFAULT_CATEGORIES = [
  { name: 'Salary', type: 'income', color: '#2f9e6b' },
  { name: 'Side income', type: 'income', color: '#4cb5a3' },
  { name: 'Rent', type: 'expense', color: '#7c5cd6' },
  { name: 'Groceries', type: 'expense', color: '#e07a3f' },
  { name: 'Bills', type: 'expense', color: '#3b82c4' },
  { name: 'Transport', type: 'expense', color: '#d4a42c' },
  { name: 'Eating out', type: 'expense', color: '#d9534f' },
  { name: 'Health', type: 'expense', color: '#3fa7d6' },
  { name: 'Fun', type: 'expense', color: '#c2569b' },
  { name: 'Other', type: 'expense', color: '#8a8f98' },
];

// CSV file: English Excel opens comma-separated files directly.
export const CSV = {
  separator: ',',
  headers: { date: 'Date', type: 'Type', category: 'Category', amount: 'Amount', note: 'Note' },
};

export const DIALOG_TEXT = {
  exportCsv: 'Save transactions as CSV',
  importCsv: 'Import transactions from a CSV file',
  csvFiles: 'CSV files',
  savePdf: 'Save report as PDF',
  pdfFiles: 'PDF files',
  deleteTitle: 'Delete transaction',
  deleteMessage: 'Delete this transaction?',
  deleteButtons: ['Delete', 'Cancel'],
  csvFileName: 'budget',
  pdfFileName: 'budget-report',
};

export const ERRORS = {
  invalidDate: 'Enter a valid date.',
  invalidType: 'The transaction type must be income or expense.',
  invalidAmount: 'The amount must be a number greater than zero (at most two decimals).',
  invalidCategory: 'Choose a category that matches the type.',
  noteTooLong: 'The note can be at most 200 characters.',
  categoryName: 'The category name cannot be empty.',
  categoryExists: 'A category with this name already exists.',
  categoryInUse: 'This category has transactions; move them to another category first.',
  notFound: 'Record not found.',
  csvEmpty: 'No transactions found in the file.',
  csvHeader: 'The first row must have Date, Type, Category and Amount columns.',
  csvLine: (line, message) => `Line ${line}: ${message}`,
};
