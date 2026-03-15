import { z } from 'zod';
import { BillcomClient } from './api-client.js';

/**
 * Bill.com MCP Tool Definitions
 *
 * 24 tools covering: Vendors, Bills (AP), Invoices (AR),
 * Customers, Payments, Received Payments, Chart of Accounts, Approvals
 */

interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  handler: (client: BillcomClient, args: any) => Promise<any>;
}

// Reusable pagination params
const paginationParams = {
  max: z.number().optional().describe('results per page (1-100)'),
  page: z.string().optional().describe('pagination token'),
};

// Reusable filter/sort params
const filterSortParams = {
  filters: z.string().optional().describe('filter (e.g. name:sw:"Acme")'),
  sort: z.string().optional().describe('sort (e.g. createdTime:desc)'),
};

export const tools: ToolDef[] = [
  // --- Vendors (4) ---
  {
    name: 'vendors_list',
    description: 'List vendors',
    inputSchema: z.object({
      ...paginationParams,
      ...filterSortParams,
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.listVendors(args),
  },
  {
    name: 'vendor_get',
    description: 'Get vendor by ID',
    inputSchema: z.object({ id: z.string().describe('vendor ID (009xxx)') }),
    handler: async (client: BillcomClient, args: { id: string }) =>
      client.getVendor(args.id),
  },
  {
    name: 'vendor_create',
    description: 'Create a new vendor',
    inputSchema: z.object({
      name: z.string().describe('vendor name'),
      payeeName: z.string().optional().describe('name on check'),
      email: z.string().optional().describe('email address'),
      phone: z.string().optional().describe('phone number'),
      address_line1: z.string().optional().describe('street address'),
      address_city: z.string().optional().describe('city'),
      address_state: z.string().optional().describe('state/province'),
      address_zip: z.string().optional().describe('zip/postal code'),
      address_country: z.string().optional().describe('country'),
    }),
    handler: async (client: BillcomClient, args: any) => {
      const data: any = { name: args.name };
      if (args.payeeName) data.payeeName = args.payeeName;
      if (args.email) data.email = args.email;
      if (args.phone) data.phone = args.phone;
      if (args.address_line1 || args.address_city) {
        data.address = {};
        if (args.address_line1) data.address.line1 = args.address_line1;
        if (args.address_city) data.address.city = args.address_city;
        if (args.address_state) data.address.stateOrProvince = args.address_state;
        if (args.address_zip) data.address.zipOrPostalCode = args.address_zip;
        if (args.address_country) data.address.country = args.address_country;
      }
      return client.createVendor(data);
    },
  },
  {
    name: 'vendor_update',
    description: 'Update a vendor',
    inputSchema: z.object({
      id: z.string().describe('vendor ID (009xxx)'),
      name: z.string().optional().describe('new name'),
      email: z.string().optional().describe('new email'),
      phone: z.string().optional().describe('new phone'),
    }),
    handler: async (client: BillcomClient, args: any) => {
      const { id, ...data } = args;
      return client.updateVendor(id, data);
    },
  },

  // --- Bills / AP (4) ---
  {
    name: 'bills_list',
    description: 'List bills (accounts payable)',
    inputSchema: z.object({
      ...paginationParams,
      ...filterSortParams,
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.listBills(args),
  },
  {
    name: 'bill_get',
    description: 'Get bill by ID',
    inputSchema: z.object({ id: z.string().describe('bill ID (00nxxx)') }),
    handler: async (client: BillcomClient, args: { id: string }) =>
      client.getBill(args.id),
  },
  {
    name: 'bill_create',
    description: 'Create a bill (AP)',
    inputSchema: z.object({
      vendorId: z.string().describe('vendor ID (009xxx)'),
      dueDate: z.string().describe('due date (YYYY-MM-DD)'),
      invoiceNumber: z.string().optional().describe('vendor invoice number'),
      invoiceDate: z.string().optional().describe('invoice date (YYYY-MM-DD)'),
      lineItems: z.string().describe('JSON array [{amount, description}]'),
      billApprovals: z.boolean().optional().describe('include approval info'),
    }),
    handler: async (client: BillcomClient, args: any) => {
      const data: any = {
        vendorId: args.vendorId,
        dueDate: args.dueDate,
        billLineItems: JSON.parse(args.lineItems),
      };
      if (args.invoiceNumber) {
        data.invoice = {
          invoiceNumber: args.invoiceNumber,
          invoiceDate: args.invoiceDate || args.dueDate,
        };
      }
      if (args.billApprovals) data.billApprovals = true;
      return client.createBill(data);
    },
  },
  {
    name: 'bill_update',
    description: 'Update a bill',
    inputSchema: z.object({
      id: z.string().describe('bill ID (00nxxx)'),
      dueDate: z.string().optional().describe('new due date'),
      lineItems: z.string().optional().describe('JSON updated line items'),
    }),
    handler: async (client: BillcomClient, args: any) => {
      const { id, ...updates } = args;
      const data: any = {};
      if (updates.dueDate) data.dueDate = updates.dueDate;
      if (updates.lineItems) data.billLineItems = JSON.parse(updates.lineItems);
      return client.updateBill(id, data);
    },
  },

  // --- Invoices / AR (3) ---
  {
    name: 'invoices_list',
    description: 'List invoices (accounts receivable)',
    inputSchema: z.object({
      ...paginationParams,
      ...filterSortParams,
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.listInvoices(args),
  },
  {
    name: 'invoice_get',
    description: 'Get invoice by ID',
    inputSchema: z.object({ id: z.string().describe('invoice ID (00exxx)') }),
    handler: async (client: BillcomClient, args: { id: string }) =>
      client.getInvoice(args.id),
  },
  {
    name: 'invoice_create',
    description: 'Create an invoice (AR)',
    inputSchema: z.object({
      customerId: z.string().describe('customer ID (0cuxxx)'),
      invoiceNumber: z.string().describe('invoice number'),
      invoiceDate: z.string().describe('invoice date (YYYY-MM-DD)'),
      dueDate: z.string().describe('due date (YYYY-MM-DD)'),
      lineItems: z.string().describe('JSON [{quantity, price, description}]'),
      sendEmail: z.boolean().optional().describe('email to customer'),
    }),
    handler: async (client: BillcomClient, args: any) => {
      const data: any = {
        customer: { id: args.customerId },
        invoiceNumber: args.invoiceNumber,
        invoiceDate: args.invoiceDate,
        dueDate: args.dueDate,
        invoiceLineItems: JSON.parse(args.lineItems),
      };
      if (args.sendEmail) {
        data.processingOptions = { sendEmail: true };
      }
      return client.createInvoice(data);
    },
  },

  // --- Customers (3) ---
  {
    name: 'customers_list',
    description: 'List customers',
    inputSchema: z.object({
      ...paginationParams,
      ...filterSortParams,
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.listCustomers(args),
  },
  {
    name: 'customer_get',
    description: 'Get customer by ID',
    inputSchema: z.object({ id: z.string().describe('customer ID (0cuxxx)') }),
    handler: async (client: BillcomClient, args: { id: string }) =>
      client.getCustomer(args.id),
  },
  {
    name: 'customer_create',
    description: 'Create a new customer',
    inputSchema: z.object({
      name: z.string().describe('customer name'),
      email: z.string().describe('email address'),
      accountType: z.enum(['BUSINESS', 'PERSON']).optional().describe('account type'),
      companyName: z.string().optional().describe('company name'),
      phone: z.string().optional().describe('phone number'),
      invoiceCurrency: z.string().optional().describe('currency (e.g. USD)'),
      firstName: z.string().optional().describe('contact first name'),
      lastName: z.string().optional().describe('contact last name'),
    }),
    handler: async (client: BillcomClient, args: any) => {
      const data: any = { name: args.name, email: args.email };
      if (args.accountType) data.accountType = args.accountType;
      if (args.companyName) data.companyName = args.companyName;
      if (args.phone) data.phone = args.phone;
      if (args.invoiceCurrency) data.invoiceCurrency = args.invoiceCurrency;
      if (args.firstName || args.lastName) {
        data.contact = {};
        if (args.firstName) data.contact.firstName = args.firstName;
        if (args.lastName) data.contact.lastName = args.lastName;
      }
      return client.createCustomer(data);
    },
  },

  // --- Sent Payments / AP (2) ---
  {
    name: 'payments_list',
    description: 'List sent payments (AP)',
    inputSchema: z.object({
      ...paginationParams,
      ...filterSortParams,
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.listPayments(args),
  },
  {
    name: 'payment_get',
    description: 'Get sent payment by ID',
    inputSchema: z.object({ id: z.string().describe('payment ID') }),
    handler: async (client: BillcomClient, args: { id: string }) =>
      client.getPayment(args.id),
  },

  // --- Received Payments / AR (2) ---
  {
    name: 'received_payments_list',
    description: 'List received payments (AR)',
    inputSchema: z.object({
      ...paginationParams,
      ...filterSortParams,
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.listReceivedPayments(args),
  },
  {
    name: 'received_payment_get',
    description: 'Get received payment by ID',
    inputSchema: z.object({ id: z.string().describe('received payment ID') }),
    handler: async (client: BillcomClient, args: { id: string }) =>
      client.getReceivedPayment(args.id),
  },

  // --- Chart of Accounts (2) ---
  {
    name: 'chart_of_accounts_list',
    description: 'List chart of accounts',
    inputSchema: z.object({
      ...paginationParams,
      ...filterSortParams,
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.listChartOfAccounts(args),
  },
  {
    name: 'chart_of_account_get',
    description: 'Get chart of account by ID',
    inputSchema: z.object({ id: z.string().describe('account ID') }),
    handler: async (client: BillcomClient, args: { id: string }) =>
      client.getChartOfAccount(args.id),
  },

  // --- Approvals (3) ---
  {
    name: 'pending_approvals_list',
    description: 'List bills pending your approval',
    inputSchema: z.object({}),
    handler: async (client: BillcomClient) =>
      client.listPendingApprovals(),
  },
  {
    name: 'bill_approve',
    description: 'Approve or deny a bill',
    inputSchema: z.object({
      billId: z.string().describe('bill ID (00nxxx)'),
      action: z.enum(['APPROVE', 'DENY']).describe('approval action'),
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.approveBill(args.billId, args.action),
  },
  {
    name: 'approval_policies_list',
    description: 'List approval policies',
    inputSchema: z.object({
      ...paginationParams,
    }),
    handler: async (client: BillcomClient, args: any) =>
      client.listApprovalPolicies(args),
  },
];
