/*
  FOK Academy - Dedicated Checkout Page Handler
  - Syncs persistent 10-minute timer with localStorage
  - Validates student form fields
  - Initiates HDFC SmartGateway payment order session via /api/create-payment-order
*/

const OFFER_DURATION = 10 * 60 * 1000;
const STORAGE_KEY = "fok_offer_expires_at";

function getStoredExpiration() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {
    console.warn("localStorage unavailable:", e);
  }
  return null;
}

function setStoredExpiration(timestamp) {
  try {
    localStorage.setItem(STORAGE_KEY, timestamp.toString());
  } catch (e) {
    console.warn("localStorage set failed:", e);
  }
}

let offerExpiresAt = getStoredExpiration();
if (!offerExpiresAt) {
  offerExpiresAt = Date.now() + OFFER_DURATION;
  setStoredExpiration(offerExpiresAt);
}

let isOfferExpired = false;

const topCountdown = document.getElementById("topCountdown");
const checkoutClock = document.getElementById("checkoutClock");
const checkoutPriceTag = document.getElementById("checkoutPriceTag");
const pricingNote = document.getElementById("pricingNote");
const timerBannerLabel = document.getElementById("timerBannerLabel");

let timer = null;

function updateCheckoutTimer() {
  const remaining = Math.max(0, offerExpiresAt - Date.now());
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const timeString = `${mm}:${ss}`;

  if (topCountdown) topCountdown.textContent = timeString;
  if (checkoutClock) checkoutClock.textContent = timeString;

  if (remaining <= 0) {
    isOfferExpired = true;
    if (timer) clearInterval(timer);

    if (topCountdown) topCountdown.textContent = "EXPIRED";
    if (checkoutClock) checkoutClock.textContent = "00:00";
    if (checkoutPriceTag) checkoutPriceTag.textContent = "₹899";
    if (pricingNote) pricingNote.textContent = "Offer Expired. Current Price: ₹899";
    if (timerBannerLabel) timerBannerLabel.textContent = "₹499 Offer Expired";
  }
}

updateCheckoutTimer();
timer = setInterval(updateCheckoutTimer, 250);

// Form Submission & HDFC Payment Link Generation
const checkoutForm = document.getElementById('checkoutForm');
const paySubmitBtn = document.getElementById('paySubmitBtn');
const btnText = paySubmitBtn?.querySelector('.btn-text');
const btnSpinner = paySubmitBtn?.querySelector('.btn-spinner');
const formAlert = document.getElementById('formAlert');

// Sync Amount Selector Radios & URL Params
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paramAmount = urlParams.get('amount');
  const amountRadios = document.querySelectorAll('input[name="selected_amount"]');

  if (paramAmount && ['499', '899', '999'].includes(paramAmount)) {
    const targetRadio = document.querySelector(`input[name="selected_amount"][value="${paramAmount}"]`);
    if (targetRadio) targetRadio.checked = true;
  }

  function updateAmountCardStyles() {
    amountRadios.forEach((radio) => {
      const card = radio.closest('.amount-card');
      if (!card) return;
      if (radio.checked) {
        card.style.border = '2px solid var(--gold)';
        card.style.background = '#fffdf7';
      } else {
        card.style.border = '1px solid var(--line)';
        card.style.background = 'white';
      }
    });

    const checkedRadio = document.querySelector('input[name="selected_amount"]:checked');
    const selectedVal = checkedRadio ? checkedRadio.value : '499';
    const paySubmitBtn = document.getElementById('paySubmitBtn');
    const btnText = paySubmitBtn?.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = `Proceed to HDFC SmartGateway (₹${selectedVal}) →`;
    }
  }

  amountRadios.forEach((radio) => {
    radio.addEventListener('change', updateAmountCardStyles);
  });

  updateAmountCardStyles();
});

if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('studentName');
    const emailInput = document.getElementById('studentEmail');
    const phoneInput = document.getElementById('studentPhone');

    const nameErr = document.getElementById('nameError');
    const emailErr = document.getElementById('emailError');
    const phoneErr = document.getElementById('phoneError');

    if (nameErr) nameErr.textContent = '';
    if (emailErr) emailErr.textContent = '';
    if (phoneErr) phoneErr.textContent = '';
    if (formAlert) formAlert.style.display = 'none';

    let isValid = true;

    const nameVal = nameInput?.value.trim() || '';
    if (!nameVal || nameVal.length < 2) {
      if (nameErr) nameErr.textContent = 'Please enter your full name.';
      isValid = false;
    }

    const emailVal = emailInput?.value.trim() || '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      if (emailErr) emailErr.textContent = 'Please enter a valid email address.';
      isValid = false;
    }

    const countryCodeSelect = document.getElementById('countryCodeSelect');
    const countryCodeVal = countryCodeSelect?.value || '+91';
    const phoneVal = phoneInput?.value.replace(/\D/g, '') || '';

    if (countryCodeVal === '+91' && phoneVal.length !== 10) {
      if (phoneErr) phoneErr.textContent = 'Please enter a valid mobile number.';
      isValid = false;
    } else if (phoneVal.length < 7 || phoneVal.length > 15) {
      if (phoneErr) phoneErr.textContent = 'Please enter a valid mobile number.';
      isValid = false;
    }

    if (!isValid) return;

    if (btnText) btnText.style.display = 'none';
    if (btnSpinner) btnSpinner.style.display = 'inline-block';
    if (paySubmitBtn) paySubmitBtn.disabled = true;

    const selectedRadio = document.querySelector('input[name="selected_amount"]:checked');
    const selectedAmount = selectedRadio ? parseFloat(selectedRadio.value) : 499;

    try {
      const response = await fetch('/api/create-payment-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameVal,
          email: emailVal,
          phone: `${countryCodeVal}${phoneVal}`,
          amount: selectedAmount,
          isExpired: isOfferExpired
        })
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        const errorMsg = data.message || data.error?.error_message || data.error?.user_message || 'Could not initiate HDFC payment session.';
        throw new Error(errorMsg);
      }

    } catch (err) {
      console.error('[Checkout Error]:', err);
      if (formAlert) {
        formAlert.textContent = err.message || 'Failed to connect to HDFC Gateway. Please try again.';
        formAlert.style.display = 'block';
      }

      if (btnText) btnText.style.display = 'inline-block';
      if (btnSpinner) btnSpinner.style.display = 'none';
      if (paySubmitBtn) paySubmitBtn.disabled = false;
    }
  });
}
