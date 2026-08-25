const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Normalize request URL for Vercel serverless rewrites
app.use((req, res, next) => {
  const forwardedUrl = req.headers['x-forwarded-url'] || req.headers['x-matched-path'];
  if (forwardedUrl) {
    try {
      const parsed = new URL(forwardedUrl, 'http://localhost');
      req.url = parsed.pathname + parsed.search;
    } catch (e) {
      // ignore
    }
  }
  next();
});

// Prevent browser caching during local testing & development
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// In-memory order database for verification (In production, replace with DB like PostgreSQL/MongoDB)
const ordersDB = new Map();

// Helper: HDFC SmartGateway API Configuration
const getHdfcConfig = () => {
  const isSandbox = (process.env.HDFC_ENV || 'SANDBOX').toUpperCase() === 'SANDBOX';
  const baseUrl = isSandbox
    ? 'https://smartgateway.hdfcuat.bank.in'
    : 'https://smartgateway.hdfc.bank.in';
  
  return {
    baseUrl,
    merchantId: process.env.HDFC_MERCHANT_ID || 'FOK_MERCHANT_TEST',
    clientId: process.env.HDFC_CLIENT_ID || 'hdfcmaster',
    apiKey: process.env.HDFC_API_KEY || 'test_api_key',
    responseSecret: process.env.HDFC_RESPONSE_SECRET || '',
    isSandbox
  };
};

const buildGatewayReturnUrl = (appBaseUrl) => {
  const configuredReturnUrl = (process.env.RETURN_URL || '').trim();

  if (!configuredReturnUrl) {
    return `${appBaseUrl}/api/payment-return`;
  }

  // Payment gateways often POST back to the return URL, so route through
  // a backend endpoint before redirecting to the user-facing status page.
  if (configuredReturnUrl.endsWith('/payment-status.html')) {
    return configuredReturnUrl.replace(/\/payment-status\.html$/, '/api/payment-return');
  }

  return configuredReturnUrl;
};

const buildCustomerId = ({ email, phone }) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedPhone = (phone || '').replace(/\D/g, '');
  const rawCustomerKey = `${normalizedEmail}|${normalizedPhone}`;
  const hash = crypto
    .createHash('sha256')
    .update(rawCustomerKey)
    .digest('hex')
    .slice(0, 18);

  return `cust_${hash}`;
};

const isSupabaseConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const isSupabaseAuthConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

const supabaseTableUrl = () =>
  `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/payment_orders`;

const supabaseAuthUrl = (path) =>
  `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1${path}`;

const supabaseHeaders = (prefer = 'return=representation') => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: prefer
});

const supabaseAuthHeaders = () => ({
  apikey: process.env.SUPABASE_ANON_KEY,
  'Content-Type': 'application/json'
});

const parseCookies = (cookieHeader = '') =>
  cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, chunk) => {
      const separatorIndex = chunk.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = chunk.slice(0, separatorIndex).trim();
      const value = chunk.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});

const getAdminTokenFromRequest = (req) =>
  parseCookies(req.headers.cookie || '').fok_admin_token || '';

const setAdminCookie = (res, accessToken) => {
  const parts = [
    `fok_admin_token=${encodeURIComponent(accessToken)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=28800',
    'Secure'
  ];

  res.setHeader('Set-Cookie', parts.join('; '));
};

const clearAdminCookie = (res) => {
  res.setHeader('Set-Cookie', 'fok_admin_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure');
};

const getAdminUserFromRequest = async (req) => {
  if (!isSupabaseAuthConfigured()) return null;

  const accessToken = getAdminTokenFromRequest(req);
  if (!accessToken) return null;

  try {
    const response = await axios.get(supabaseAuthUrl('/user'), {
      headers: {
        ...supabaseAuthHeaders(),
        Authorization: `Bearer ${accessToken}`
      },
      timeout: 8000
    });

    return response.data || null;
  } catch (error) {
    console.warn('[Supabase Admin Auth Warning]:', error.response?.data || error.message);
    return null;
  }
};

const toDbOrder = (order) => ({
  order_id: order.orderId,
  hdfc_order_ref: order.hdfcOrderRef || null,
  customer_id: order.customerId || null,
  customer_name: order.customerName || null,
  customer_email: order.customerEmail || null,
  customer_phone: order.customerPhone || null,
  amount: order.amount ?? null,
  currency: order.currency || 'INR',
  status: order.status || 'PENDING',
  transaction_id: order.transactionId || null,
  payment_method_type: order.paymentMethodType || null,
  verified: typeof order.verified === 'boolean' ? order.verified : false,
  verification_source: order.verificationSource || null,
  gateway_response: order.gatewayResponse || null,
  gateway_status_response: order.hdfcDetails || null,
  paid_at: order.paidAt || null,
  created_at: order.createdAt || new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const fromDbOrder = (row) => {
  if (!row) return null;

  return {
    orderId: row.order_id,
    hdfcOrderRef: row.hdfc_order_ref,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    amount: typeof row.amount === 'number' ? row.amount : parseFloat(row.amount || 0),
    currency: row.currency || 'INR',
    status: row.status || 'PENDING',
    transactionId: row.transaction_id || '',
    paymentMethodType: row.payment_method_type || '',
    verified: Boolean(row.verified),
    verificationSource: row.verification_source || '',
    gatewayResponse: row.gateway_response || null,
    hdfcDetails: row.gateway_status_response || null,
    paidAt: row.paid_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
};

const saveOrder = async (order) => {
  ordersDB.set(order.orderId, order);

  if (!isSupabaseConfigured()) {
    console.warn(`[Supabase Save Skipped] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for order ${order.orderId}`);
    return order;
  }

  try {
    const response = await axios.post(`${supabaseTableUrl()}?on_conflict=order_id`, toDbOrder(order), {
      headers: supabaseHeaders('resolution=merge-duplicates,return=representation')
    });

    console.log(`[Supabase Save OK] Order ${order.orderId} persisted`);
    return fromDbOrder(response.data?.[0]) || order;
  } catch (error) {
    console.error('[Supabase Save Order Error]:', error.response?.data || error.message);
    return order;
  }
};

const getStoredOrder = async (orderId) => {
  if (ordersDB.has(orderId)) {
    return ordersDB.get(orderId);
  }

  if (!isSupabaseConfigured()) {
    console.warn(`[Supabase Get Skipped] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for order ${orderId}`);
    return null;
  }

  try {
    const response = await axios.get(`${supabaseTableUrl()}?order_id=eq.${encodeURIComponent(orderId)}&select=*`, {
      headers: supabaseHeaders()
    });

    const order = fromDbOrder(response.data?.[0]);
    if (order) {
      ordersDB.set(orderId, order);
      console.log(`[Supabase Get OK] Order ${orderId} loaded`);
    }
    return order;
  } catch (error) {
    console.error('[Supabase Get Order Error]:', error.response?.data || error.message);
    return null;
  }
};

/**
 * 1. POST /api/create-payment-order
 * Creates an order session with HDFC SmartGateway (or mock fallback for local test mode)
 */
app.post('/api/create-payment-order', async (req, res) => {
  try {
    const { name, email, phone, isExpired } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, Email, and Phone number are required.'
      });
    }

    // Extract all numeric digits from phone number (supports international and variable length numbers)
    const cleanPhone = phone.replace(/\D/g, '') || '9999999999';

    // Determine amount (enforced server-side)
    let amount;
    if (process.env.TEST_PRICE && !isNaN(parseFloat(process.env.TEST_PRICE)) && parseFloat(process.env.TEST_PRICE) > 0) {
      amount = parseFloat(process.env.TEST_PRICE);
    } else {
      const offerPrice = parseFloat(process.env.OFFER_PRICE || '499');
      const regularPrice = parseFloat(process.env.REGULAR_PRICE || '899');
      amount = isExpired ? regularPrice : offerPrice;
    }

    // Generate unique order ID (must be alphanumeric, no special chars, < 21 chars)
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderId = `FOK${Date.now()}${randomSuffix}`.slice(0, 20);

    const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const returnUrl = buildGatewayReturnUrl(appBaseUrl);

    const config = getHdfcConfig();
    const customerId = buildCustomerId({ email, phone: cleanPhone });

    // Store pending order details
    const orderData = {
      orderId,
      customerName: name,
      customerEmail: email,
      customerPhone: cleanPhone,
      customerId,
      amount,
      currency: 'INR',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    await saveOrder(orderData);

    console.log(`[HDFC Gateway] Creating order ${orderId} for ${name} (${amount} INR)`);

    // Check if real API credentials are set or fallback to Interactive Mock Gateway
    const isMockMode = config.merchantId.includes('TEST') || config.apiKey.includes('test_api_key');

    if (isMockMode) {
      console.log(`[HDFC Gateway] Running in Mock/Sandbox Mode for order ${orderId}`);
      
      const mockCheckoutUrl = `${appBaseUrl}/payment-status.html?mock_checkout=1&order_id=${orderId}&amount=${amount}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(cleanPhone)}`;

      return res.json({
        success: true,
        orderId,
        amount,
        currency: 'INR',
        paymentUrl: mockCheckoutUrl,
        isMock: true
      });
    }

    // Official HDFC SmartGateway Session API Payload & Headers
    const paymentPageClientId = config.isSandbox 
      ? 'hdfcmaster' 
      : (process.env.HDFC_CLIENT_ID && process.env.HDFC_CLIENT_ID !== 'hdfcmaster' ? process.env.HDFC_CLIENT_ID : config.merchantId);

    const payload = {
      order_id: orderId,
      amount: amount.toFixed(2),
      currency: 'INR',
      customer_id: customerId,
      customer_email: email,
      customer_phone: cleanPhone,
      customer_name: name,
      first_name: name.split(' ')[0] || name,
      payment_page_client_id: paymentPageClientId,
      action: 'paymentPage',
      return_url: returnUrl,
      description: 'FOK Academy Amazon Seller Masterclass Course Enrollment'
    };

    // Basic Auth header using HDFC API key (Base64 encoding without trailing colon as per HDFC spec)
    const rawApiKey = (config.apiKey || '').trim();
    const base64ApiKey = Buffer.from(rawApiKey).toString('base64');
    const authHeader = rawApiKey.startsWith('Basic ') ? rawApiKey : `Basic ${base64ApiKey}`;

    const headers = {
      'x-merchantid': config.merchantId,
      'x-customerid': customerId,
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    };

    console.log(`[HDFC Session Request] BaseURL: ${config.baseUrl}/session, OrderID: ${orderId}, Merchant: ${config.merchantId}, ClientID: ${paymentPageClientId}`);

    const response = await axios.post(`${config.baseUrl}/session`, payload, {
      headers,
      timeout: 10000
    });

    console.log('[HDFC Session Response]:', JSON.stringify(response.data, null, 2));

    if (response.data && (response.data.payment_links?.web || response.data.payment_url || response.data.payment_links)) {
      const paymentUrl = typeof response.data.payment_links === 'string' 
        ? response.data.payment_links 
        : (response.data.payment_links?.web || response.data.payment_url);

      console.log('[HDFC Checkout URL]:', paymentUrl);

      const persistedOrder = await getStoredOrder(orderId) || orderData;
      persistedOrder.gatewayResponse = response.data;
      persistedOrder.hdfcOrderRef = response.data.id || persistedOrder.hdfcOrderRef;
      await saveOrder(persistedOrder);

      return res.json({
        success: true,
        orderId,
        amount,
        currency: 'INR',
        paymentUrl,
        sessionData: response.data
      });
    } else {
      throw new Error(response.data?.error_message || 'Invalid session response structure from HDFC SmartGateway');
    }

  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error('[HDFC Gateway Session Error]:', JSON.stringify(errorDetails));

    const errorMessage = error.response?.data?.error_message 
      || error.response?.data?.message 
      || (typeof error.response?.data === 'string' ? error.response.data : null)
      || error.message 
      || 'Payment session creation failed.';

    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: errorDetails
    });
  }
});

/**
 * 2. GET /api/verify-payment
    } else {
      throw new Error(response.data?.error_message || 'Invalid session response structure from HDFC SmartGateway');
    }

  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error('[HDFC Gateway Session Error]:', JSON.stringify(errorDetails));

    const errorMessage = error.response?.data?.error_message 
      || error.response?.data?.message 
      || (typeof error.response?.data === 'string' ? error.response.data : null)
      || error.message 
      || 'Payment session creation failed.';

    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: errorDetails
    });
  }
});

/**
 * 2. GET /api/verify-payment
 * Verifies order status by checking internal DB or calling HDFC SmartGateway Status API S2S
 */
app.get('/api/verify-payment', async (req, res) => {
  try {
    const { order_id, mock_action } = req.query;

    console.log(`[ORDER STATUS API REQUEST] order_id: ${order_id}, mock_action: ${mock_action || 'none'}`);

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'order_id parameter is required.' });
    }

    let order = await getStoredOrder(order_id);

    // If mock payment action passed in query (simulate success / fail)
    if (mock_action && order) {
      if (mock_action === 'SUCCESS') {
        order.status = 'CHARGED';
        order.transactionId = `TXN_HDFC_${Date.now()}`;
        order.paidAt = new Date().toISOString();
      } else if (mock_action === 'FAILURE') {
        order.status = 'FAILED';
      }
      await saveOrder(order);
    }

    if (order && !order.orderId) {
      order.orderId = order_id;
    }

    // If real API credentials are configured, fetch live status from HDFC SmartGateway S2S API
    const config = getHdfcConfig();
    const isMockMode = config.isSandbox || config.merchantId.includes('TEST') || config.apiKey.includes('test_api_key');

    if (config.isSandbox && !mock_action) {
      if (!order) {
        order = {
          orderId: order_id,
          amount: parseFloat(process.env.TEST_PRICE || process.env.OFFER_PRICE || '499'),
          currency: 'INR',
          customerName: 'Student',
          status: 'CHARGED'
        };
      }

      order.status = 'CHARGED';
      order.verified = true;
      order.verificationSource = 'sandbox-demo';
      order.transactionId = order.transactionId || `UAT_${Date.now()}`;
      order.paymentMethodType = order.paymentMethodType || 'UPI';
      await saveOrder(order);

      const responsePayload = {
        success: true,
        order
      };
      console.log('[ORDER STATUS API RESPONSE]:', JSON.stringify(responsePayload, null, 2));

      return res.json(responsePayload);
    }

    if ((!order || !order.status || order.status === 'PENDING') && (!config.merchantId.includes('TEST') || config.isSandbox)) {
      try {
        const rawApiKey = (config.apiKey || '').trim();
        const base64ApiKey = Buffer.from(rawApiKey).toString('base64');
        const authHeader = rawApiKey.startsWith('Basic ') ? rawApiKey : `Basic ${base64ApiKey}`;
        const customerId = order?.customerId || `cust${(order?.customerPhone || '').replace(/\D/g, '')}`;

        console.log(`[HDFC Gateway Status Request] Fetching status from: ${config.baseUrl}/orders/${order_id}`);

        const hdfcRes = await axios.get(`${config.baseUrl}/orders/${order_id}`, {
          headers: {
            'x-merchantid': config.merchantId,
            'x-customerid': customerId,
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          timeout: 7000
        });

        console.log('[HDFC Gateway Status API Raw Response & Format]:', JSON.stringify(hdfcRes.data, null, 2));

        if (hdfcRes.data && hdfcRes.data.status) {
          console.log('[HDFC Order Status Response]:', JSON.stringify(hdfcRes.data, null, 2));

          if (!order) {
            order = {
              orderId: hdfcRes.data.order_id || order_id
            };
          }

          order.status = hdfcRes.data.status;
          order.amount = parseFloat(hdfcRes.data.amount || order.amount || 0);
          order.currency = hdfcRes.data.currency || order.currency || 'INR';
          order.customerName = hdfcRes.data.customer_name || order.customerName || '';
          order.customerEmail = hdfcRes.data.customer_email || order.customerEmail || '';
          order.customerPhone = hdfcRes.data.customer_phone || order.customerPhone || '';
          order.transactionId = hdfcRes.data.txn_id || order.transactionId || '';
          order.paymentMethodType =
            hdfcRes.data.payment_method_type ||
            hdfcRes.data.payment_method ||
            hdfcRes.data.method ||
            order.paymentMethodType ||
            '';
          order.hdfcDetails = hdfcRes.data;
          order.verificationSource = 'status_api';
          order.verified = Boolean(order.transactionId) && order.status === 'CHARGED';
          await saveOrder(order);
          console.log(`[HDFC Status API S2S] Order ${order_id} verified as ${order.status}`);
        }
      } catch (hdfcErr) {
        console.warn('[HDFC Status Check Notice]:', hdfcErr.response?.data || hdfcErr.message);
      }
    }

    if (!order) {
      order = {
        orderId: order_id,
        amount: 0,
        status: 'PENDING',
        verified: false,
        verificationSource: 'unknown'
      };
    }

    if (mock_action === 'SUCCESS') {
      order.verified = true;
      order.verificationSource = 'mock';
    } else if (config.isSandbox) {
      // Allow demo success screens in UAT even though no real money moves there.
      order.verified = order.status === 'CHARGED';
      order.verificationSource = 'sandbox-demo';
    } else if (typeof order.verified !== 'boolean') {
      order.verified = Boolean(order.transactionId) && order.status === 'CHARGED';
    }

    await saveOrder(order);

    const responsePayload = {
      success: true,
      order
    };
    console.log('[ORDER STATUS API RESPONSE]:', JSON.stringify(responsePayload, null, 2));

    return res.json(responsePayload);

  } catch (error) {
    console.error('[Verify Payment Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Verification error' });
  }
});

/**
 * 3. POST /api/payment-webhook
 * HDFC SmartGateway Webhook Endpoint to handle asynchronous transaction updates
 */
app.post('/api/payment-webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('[HDFC Webhook Received]:', JSON.stringify(payload, null, 2));

    const config = getHdfcConfig();
    const signature = req.headers['x-juspay-signature'] || req.headers['x-hdfc-signature'];

    // Signature verification logic
    if (signature && config.responseSecret) {
      const calculatedSignature = crypto
        .createHmac('sha256', config.responseSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== calculatedSignature) {
        console.warn('[HDFC Webhook Warning] Signature mismatch!');
      }
    }

    const { order_id, status, txn_id } = payload;
    const order = order_id ? await getStoredOrder(order_id) : null;
    if (order_id && order) {
      order.status = status || 'CHARGED';
      order.transactionId = txn_id || `TXN_${Date.now()}`;
      order.paymentMethodType =
        payload.payment_method_type ||
        payload.payment_method ||
        payload.method ||
        order.paymentMethodType ||
        '';
      order.hdfcDetails = payload;
      order.verified = order.status === 'CHARGED';
      order.verificationSource = 'webhook';
      order.updatedAt = new Date().toISOString();
      await saveOrder(order);
      console.log(`[HDFC Webhook] Order ${order_id} updated to ${order.status}`);
    }

    // Acknowledge receipt to HDFC SmartGateway
    return res.status(200).json({ status: 'OK' });

  } catch (error) {
    console.error('[HDFC Webhook Error]:', error.message);
    return res.status(500).json({ status: 'ERROR' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    if (!isSupabaseAuthConfigured()) {
      return res.status(500).json({ success: false, message: 'Supabase Auth is not configured.' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const response = await axios.post(
      `${supabaseAuthUrl('/token')}?grant_type=password`,
      { email, password },
      {
        headers: supabaseAuthHeaders(),
        timeout: 10000
      }
    );

    if (!response.data?.access_token || !response.data?.user) {
      return res.status(401).json({ success: false, message: 'Invalid admin login.' });
    }

    setAdminCookie(res, response.data.access_token);

    return res.json({
      success: true,
      user: {
        id: response.data.user.id,
        email: response.data.user.email
      }
    });
  } catch (error) {
    console.error('[Admin Login Error]:', error.response?.data || error.message);
    return res.status(401).json({
      success: false,
      message: error.response?.data?.msg || error.response?.data?.message || 'Unable to sign in.'
    });
  }
});

app.get('/api/admin/me', async (req, res) => {
  const user = await getAdminUserFromRequest(req);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email
    }
  });
});

app.post('/api/admin/logout', async (req, res) => {
  clearAdminCookie(res);
  return res.json({ success: true });
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const user = await getAdminUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!isSupabaseConfigured()) {
      return res.status(500).json({ success: false, message: 'Supabase storage is not configured.' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 250);
    const response = await axios.get(
      `${supabaseTableUrl()}?select=order_id,customer_name,customer_email,customer_phone,amount,currency,status,transaction_id,payment_method_type,verified,verification_source,created_at,updated_at,paid_at&order=created_at.desc&limit=${limit}`,
      {
        headers: supabaseHeaders(),
        timeout: 10000
      }
    );

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      orders: response.data || []
    });
  } catch (error) {
    console.error('[Admin Orders Error]:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to load admin orders.'
    });
  }
});

// Accept HDFC/Juspay browser returns, then redirect to the user-facing status page.
app.all('/api/payment-return', (req, res) => {
  const orderId = req.body?.order_id || req.body?.orderId || req.query?.order_id || req.query?.orderId;

  if (orderId) {
    return res.redirect(`/payment-status.html?order_id=${encodeURIComponent(orderId)}`);
  }

  return res.redirect('/payment-status.html');
});

// Handle direct HTTP POST and GET redirects to payment-status.html from HDFC SmartGateway
// for backward compatibility with older RETURN_URL values.
app.all('/payment-status.html', (req, res) => {
  if (req.method === 'POST') {
    const orderId = req.body?.order_id || req.body?.orderId || req.query?.order_id || req.query?.orderId;
    if (orderId) {
      return res.redirect(`/payment-status.html?order_id=${encodeURIComponent(orderId)}`);
    }
  }
  res.sendFile(path.join(__dirname, 'public', 'payment-status.html'));
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback route to serve main landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export app for Vercel serverless functions
module.exports = app;

// Start server locally when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 FOK Academy Server running on http://localhost:${PORT}`);
    console.log(`💳 HDFC SmartGateway Mode: ${process.env.HDFC_ENV || 'SANDBOX'}`);
    console.log(`==================================================`);
  });
}
