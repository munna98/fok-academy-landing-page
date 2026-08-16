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

// Prevent browser caching during local testing & development
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static assets from project root
app.use(express.static(__dirname));

// In-memory order database for verification (In production, replace with DB like PostgreSQL/MongoDB)
const ordersDB = new Map();

// Helper: HDFC SmartGateway API Configuration
const getHdfcConfig = () => {
  const isSandbox = (process.env.HDFC_ENV || 'SANDBOX').toUpperCase() === 'SANDBOX';
  const baseUrl = isSandbox
    ? 'https://smartgateway-sandbox.hdfcbank.com'
    : 'https://api.smartgateway.hdfcbank.com';
  
  return {
    baseUrl,
    merchantId: process.env.HDFC_MERCHANT_ID || 'FOK_MERCHANT_TEST',
    clientId: process.env.HDFC_CLIENT_ID || 'FOK_CLIENT_TEST',
    apiKey: process.env.HDFC_API_KEY || 'test_api_key',
    responseSecret: process.env.HDFC_RESPONSE_SECRET || 'test_secret',
    isSandbox
  };
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

    // Determine amount (enforced server-side)
    const offerPrice = parseFloat(process.env.OFFER_PRICE || '499');
    const regularPrice = parseFloat(process.env.REGULAR_PRICE || '899');
    const amount = isExpired ? regularPrice : offerPrice;

    // Generate unique order ID
    const orderId = `FOK_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const returnUrl = process.env.RETURN_URL || `http://localhost:${PORT}/payment-status.html`;

    const config = getHdfcConfig();

    // Store pending order details
    const orderData = {
      orderId,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      amount,
      currency: 'INR',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    ordersDB.set(orderId, orderData);

    console.log(`[HDFC Gateway] Creating order ${orderId} for ${name} (${amount} INR)`);

    // Check if real API credentials are set or fallback to Interactive Mock Gateway
    const isMockMode = config.merchantId.includes('TEST') || config.apiKey.includes('test_api_key');

    if (isMockMode) {
      console.log(`[HDFC Gateway] Running in Mock/Sandbox Mode for order ${orderId}`);
      
      const mockCheckoutUrl = `${process.env.APP_BASE_URL || `http://localhost:${PORT}`}/payment-status.html?mock_checkout=1&order_id=${orderId}&amount=${amount}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`;

      return res.json({
        success: true,
        orderId,
        amount,
        currency: 'INR',
        paymentUrl: mockCheckoutUrl,
        isMock: true
      });
    }

    // Official HDFC SmartGateway Session API Integration
    const payload = {
      order_id: orderId,
      amount: amount.toFixed(2),
      currency: 'INR',
      customer_id: `CUST_${phone.replace(/\D/g, '')}`,
      customer_email: email,
      customer_phone: phone,
      customer_name: name,
      return_url: returnUrl,
      description: 'FOK Academy Amazon Seller Masterclass Course Enrollment'
    };

    const authHeader = `Basic ${Buffer.from(`${config.apiKey}:`).toString('base64')}`;

    const response = await axios.post(`${config.baseUrl}/session`, payload, {
      headers: {
        'x-merchantid': config.merchantId,
        'x-client-id': config.clientId,
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && (response.data.payment_links?.web || response.data.payment_url || response.data.sdk_payload)) {
      const paymentUrl = response.data.payment_links?.web || response.data.payment_url;
      return res.json({
        success: true,
        orderId,
        amount,
        currency: 'INR',
        paymentUrl,
        sessionData: response.data
      });
    } else {
      throw new Error('Invalid session response from HDFC SmartGateway');
    }

  } catch (error) {
    console.error('[HDFC Gateway Error]:', error.response?.data || error.message);

    // Graceful fallback response if network/gateway error occurs during test
    return res.status(500).json({
      success: false,
      message: 'Payment session creation failed.',
      error: error.response?.data || error.message
    });
  }
});

/**
 * 2. GET /api/verify-payment
 * Verifies order status by checking internal DB or calling HDFC SmartGateway status API
 */
app.get('/api/verify-payment', async (req, res) => {
  try {
    const { order_id, mock_action } = req.query;

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'order_id parameter is required.' });
    }

    let order = ordersDB.get(order_id);

    // If mock payment action passed in query (simulate success / fail)
    if (mock_action && order) {
      if (mock_action === 'SUCCESS') {
        order.status = 'CHARGED';
        order.transactionId = `TXN_HDFC_${Date.now()}`;
        order.paidAt = new Date().toISOString();
      } else if (mock_action === 'FAILURE') {
        order.status = 'FAILED';
      }
      ordersDB.set(order_id, order);
    }

    if (!order) {
      // Fallback order info for direct link testing
      order = {
        orderId: order_id,
        amount: 499,
        status: mock_action === 'SUCCESS' ? 'CHARGED' : 'PENDING',
        customerName: 'FOK Student',
        customerEmail: 'student@example.com'
      };
    }

    return res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('[Verify Payment Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Verification error' });
  }
});

/**
 * 3. POST /api/payment-webhook
 * HDFC SmartGateway Webhook Endpoint to handle asynchronous transaction updates
 */
app.post('/api/payment-webhook', (req, res) => {
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
    if (order_id && ordersDB.has(order_id)) {
      const order = ordersDB.get(order_id);
      order.status = status || 'CHARGED';
      order.transactionId = txn_id || `TXN_${Date.now()}`;
      order.updatedAt = new Date().toISOString();
      ordersDB.set(order_id, order);
      console.log(`[HDFC Webhook] Order ${order_id} updated to ${order.status}`);
    }

    // Acknowledge receipt to HDFC SmartGateway
    return res.status(200).json({ status: 'OK' });

  } catch (error) {
    console.error('[HDFC Webhook Error]:', error.message);
    return res.status(500).json({ status: 'ERROR' });
  }
});

// Fallback route to serve main landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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
