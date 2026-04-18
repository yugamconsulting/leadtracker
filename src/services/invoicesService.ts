export function prependInvoice<T>(invoices: T[], invoice: T): T[] {
  return [invoice, ...invoices];
}

export function patchInvoiceById<T extends { id: string }>(
  invoices: T[],
  invoiceId: string,
  updater: (invoice: T) => T,
): T[] {
  return invoices.map((invoice) => (invoice.id === invoiceId ? updater(invoice) : invoice));
}
