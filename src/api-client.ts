/**
 * Bill.com (BILL) API Client
 *
 * Base URL: https://gateway.{env}.bill.com/connect
 * Auth: Session-based (POST /v3/login → sessionId + devKey headers)
 * Request/Response: JSON
 * Pagination: token-based (max, page from nextPage/prevPage)
 * Session expires after 35 minutes of inactivity
 */

const BASE_URLS: Record<string, string> = {
  sandbox: 'https://gateway.stage.bill.com/connect',
  production: 'https://gateway.prod.bill.com/connect',
};

export class BillcomClient {
  private devKey: string;
  private username: string;
  private password: string;
  private orgId: string;
  private baseUrl: string;
  private sessionId: string | null = null;

  constructor(
    devKey: string,
    username: string,
    password: string,
    orgId: string,
    environment: string = 'sandbox'
  ) {
    this.devKey = devKey;
    this.username = username;
    this.password = password;
    this.orgId = orgId;
    this.baseUrl = BASE_URLS[environment] || BASE_URLS.sandbox;
  }

  /**
   * Login to get a sessionId. Auto-called on first request.
   */
  async login(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v3/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
        organizationId: this.orgId,
        devKey: this.devKey,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Login failed ${response.status}: ${text}`);
    }

    const data = await response.json();
    this.sessionId = data.sessionId;
    return data;
  }

  private async ensureSession(): Promise<void> {
    if (!this.sessionId) {
      await this.login();
    }
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      params?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<T> {
    await this.ensureSession();

    const { method = 'GET', body, params } = options;
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'sessionId': this.sessionId!,
      'devKey': this.devKey,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    let response = await fetch(url.toString(), {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    // Handle session expiry (BDC_1109) — re-login and retry once
    if (response.status === 401 || response.status === 403) {
      const text = await response.text();
      if (text.includes('BDC_1109') || text.includes('session')) {
        this.sessionId = null;
        await this.ensureSession();
        headers['sessionId'] = this.sessionId!;
        response = await fetch(url.toString(), {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      }
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`BILL API Error ${response.status}: ${text}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  // --- Vendors ---
  async listVendors(params?: {
    max?: number; page?: string; filters?: string; sort?: string;
  }) {
    return this.request<any>('/v3/vendors', { params });
  }

  async getVendor(id: string) {
    return this.request<any>(`/v3/vendors/${encodeURIComponent(id)}`);
  }

  async createVendor(data: {
    name: string; payeeName?: string; email?: string; phone?: string;
    address?: { line1?: string; line2?: string; city?: string; stateOrProvince?: string; zipOrPostalCode?: string; country?: string };
  }) {
    return this.request<any>('/v3/vendors', { method: 'POST', body: data });
  }

  async updateVendor(id: string, data: any) {
    return this.request<any>(`/v3/vendors/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
  }

  // --- Bills (AP) ---
  async listBills(params?: {
    max?: number; page?: string; filters?: string; sort?: string;
  }) {
    return this.request<any>('/v3/bills', { params });
  }

  async getBill(id: string) {
    return this.request<any>(`/v3/bills/${encodeURIComponent(id)}`);
  }

  async createBill(data: {
    vendorId: string; dueDate: string;
    billLineItems: Array<{ amount: number; description?: string; quantity?: number; price?: number }>;
    invoice?: { invoiceNumber: string; invoiceDate: string };
    billApprovals?: boolean;
  }) {
    return this.request<any>('/v3/bills', { method: 'POST', body: data });
  }

  async updateBill(id: string, data: any) {
    return this.request<any>(`/v3/bills/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
  }

  // --- Invoices (AR) ---
  async listInvoices(params?: {
    max?: number; page?: string; filters?: string; sort?: string;
  }) {
    return this.request<any>('/v3/invoices', { params });
  }

  async getInvoice(id: string) {
    return this.request<any>(`/v3/invoices/${encodeURIComponent(id)}`);
  }

  async createInvoice(data: {
    customer: { id: string } | { name: string; email: string };
    invoiceNumber: string; dueDate: string; invoiceDate: string;
    invoiceLineItems: Array<{ quantity: number; price: number; description?: string }>;
    processingOptions?: { sendEmail?: boolean };
  }) {
    return this.request<any>('/v3/invoices', { method: 'POST', body: data });
  }

  // --- Customers ---
  async listCustomers(params?: {
    max?: number; page?: string; filters?: string; sort?: string;
  }) {
    return this.request<any>('/v3/customers', { params });
  }

  async getCustomer(id: string) {
    return this.request<any>(`/v3/customers/${encodeURIComponent(id)}`);
  }

  async createCustomer(data: {
    name: string; email: string; accountType?: string;
    companyName?: string; phone?: string; invoiceCurrency?: string;
    contact?: { firstName?: string; lastName?: string };
    billingAddress?: { line1?: string; city?: string; stateOrProvince?: string; zipOrPostalCode?: string; country?: string };
  }) {
    return this.request<any>('/v3/customers', { method: 'POST', body: data });
  }

  // --- Sent Payments (AP) ---
  async listPayments(params?: {
    max?: number; page?: string; filters?: string; sort?: string;
  }) {
    return this.request<any>('/v3/payments', { params });
  }

  async getPayment(id: string) {
    return this.request<any>(`/v3/payments/${encodeURIComponent(id)}`);
  }

  // --- Received Payments (AR) ---
  async listReceivedPayments(params?: {
    max?: number; page?: string; filters?: string; sort?: string;
  }) {
    return this.request<any>('/v3/receivable-payments', { params });
  }

  async getReceivedPayment(id: string) {
    return this.request<any>(`/v3/receivable-payments/${encodeURIComponent(id)}`);
  }

  // --- Chart of Accounts ---
  async listChartOfAccounts(params?: {
    max?: number; page?: string; filters?: string; sort?: string;
  }) {
    return this.request<any>('/v3/classifications/chart-of-accounts', { params });
  }

  async getChartOfAccount(id: string) {
    return this.request<any>(`/v3/classifications/chart-of-accounts/${encodeURIComponent(id)}`);
  }

  // --- Approvals ---
  async listPendingApprovals() {
    return this.request<any>('/v3/bill-approvals/pending-user-approvals');
  }

  async approveBill(billId: string, action: string = 'APPROVE') {
    return this.request<any>('/v3/bill-approvals/actions', {
      method: 'POST',
      body: { billId, action },
    });
  }

  async listApprovalPolicies(params?: {
    max?: number; page?: string;
  }) {
    return this.request<any>('/v3/bill-approvals/policies', { params });
  }
}
