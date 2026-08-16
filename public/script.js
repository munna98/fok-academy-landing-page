/*
  FOK Academy Landing Page & HDFC SmartGateway Payment Integration Script
  - Session countdown timer
  - FAQ accordion
  - Mobile navigation
  - Checkout modal trigger, validation & HDFC SmartGateway order creation
*/

// 1. 10-Minute Persistent Timer Logic
const OFFER_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const STORAGE_KEY = "fok_offer_expires_at";

function getStoredExpiration() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {
    console.warn("localStorage unavailable for countdown timer:", e);
  }
  return null;
}

function setStoredExpiration(timestamp) {
  try {
    localStorage.setItem(STORAGE_KEY, timestamp.toString());
  } catch (e) {
    console.warn("Could not save countdown timer to localStorage:", e);
  }
}

let offerExpiresAt = getStoredExpiration();
if (!offerExpiresAt) {
  offerExpiresAt = Date.now() + OFFER_DURATION;
  setStoredExpiration(offerExpiresAt);
}

let isOfferExpired = false;


const topCountdown = document.getElementById("topCountdown");
const minutesEl = document.getElementById("minutes");
const secondsEl = document.getElementById("seconds");
const priceEl = document.getElementById("coursePrice");
const statusEl = document.getElementById("offerStatus");
const enrollButton = document.getElementById("enrollButton");
const priceCard = document.querySelector(".price-card");
const mobileStickyCta = document.getElementById("mobileStickyCta");
const modalPriceTag = document.getElementById("modalPriceTag");

function updateCountdown() {
  const remaining = Math.max(0, offerExpiresAt - Date.now());
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (topCountdown) topCountdown.textContent = `${mm}:${ss}`;
  if (minutesEl) minutesEl.textContent = mm;
  if (secondsEl) secondsEl.textContent = ss;

  if (remaining <= 0) {
    isOfferExpired = true;
    clearInterval(timer);

    if (topCountdown) topCountdown.textContent = "EXPIRED";
    if (minutesEl) minutesEl.textContent = "00";
    if (secondsEl) secondsEl.textContent = "00";

    if (priceEl) priceEl.innerHTML = '₹899 <small>one time</small>';
    if (statusEl) statusEl.textContent = "The ₹499 introductory offer has expired. Current price: ₹899.";
    if (enrollButton) enrollButton.textContent = "Enroll for ₹899 →";
    if (priceCard) priceCard.classList.add("expired");
    if (modalPriceTag) modalPriceTag.textContent = "₹899";

    if (mobileStickyCta) {
      const priceText = mobileStickyCta.querySelector(".mobile-cta-info span");
      if (priceText) priceText.innerHTML = "₹899 <del>₹1299</del>";
    }
  }
}

updateCountdown();
const timer = setInterval(updateCountdown, 250);

// 2. Single Open FAQ Accordion
document.querySelectorAll('.faq-list details').forEach((detail) => {
  detail.addEventListener('toggle', () => {
    if (detail.open) {
      document.querySelectorAll('.faq-list details').forEach((other) => {
        if (other !== detail) other.removeAttribute('open');
      });
    }
  });
});

// 3. Mobile Navigation Toggle
const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');

menuBtn?.addEventListener('click', () => {
  if (!navLinks) return;
  const isVisible = navLinks.style.display === 'flex';
  navLinks.style.display = isVisible ? '' : 'flex';
  navLinks.style.position = 'absolute';
  navLinks.style.top = '100%';
  navLinks.style.left = '0';
  navLinks.style.right = '0';
  navLinks.style.padding = '20px';
  navLinks.style.background = '#fbfaf7';
  navLinks.style.flexDirection = 'column';
  navLinks.style.borderBottom = '1px solid #e5e7eb';
  navLinks.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
});

// Hide Mobile Sticky CTA when Offer Section is visible in viewport
if (mobileStickyCta && priceCard) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          mobileStickyCta.style.opacity = '0';
          mobileStickyCta.style.pointerEvents = 'none';
        } else {
          mobileStickyCta.style.opacity = '1';
          mobileStickyCta.style.pointerEvents = 'auto';
        }
      });
    },
    { threshold: 0.2 }
  );
  observer.observe(priceCard);
}

// 5. Checkout Modal & HDFC SmartGateway API Handler
const checkoutModal = document.getElementById('checkoutModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const checkoutForm = document.getElementById('checkoutForm');
const paySubmitBtn = document.getElementById('paySubmitBtn');
const btnText = paySubmitBtn?.querySelector('.btn-text');
const btnSpinner = paySubmitBtn?.querySelector('.btn-spinner');
const formAlert = document.getElementById('formAlert');

function openCheckoutModal() {
  const modal = document.getElementById('checkoutModal') || checkoutModal;
  if (!modal) {
    console.error('[Checkout Error] #checkoutModal element not found');
    return;
  }
  
  const mPriceTag = document.getElementById('modalPriceTag') || modalPriceTag;
  if (mPriceTag) {
    mPriceTag.textContent = isOfferExpired ? '₹899' : '₹499';
  }

  const fAlert = document.getElementById('formAlert') || formAlert;
  if (fAlert) {
    fAlert.style.display = 'none';
    fAlert.textContent = '';
  }

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal') || checkoutModal;
  if (!modal) return;
  modal.classList.remove('active');
  modal.style.display = 'none';
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Unified Event Delegation for Smooth Section Navigation
document.addEventListener('click', (e) => {
  const anchor = e.target.closest('a');
  if (!anchor) return;

  const href = anchor.getAttribute('href');
  
  // Allow checkout.html and external links to navigate naturally
  if (!href || href === 'checkout.html' || href.includes('.html')) {
    return;
  }

  // Handle smooth scroll for internal section anchor links (#proof, #story, #curriculum, #faq, etc.)
  if (href.startsWith('#') && href !== '#') {
    const targetElement = document.querySelector(href);
    if (targetElement) {
      e.preventDefault();
      if (navLinks && window.innerWidth <= 768) {
        navLinks.style.display = '';
      }
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }
});

if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', closeCheckoutModal);
}

if (checkoutModal) {
  checkoutModal.addEventListener('click', (e) => {
    if (e.target === checkoutModal) closeCheckoutModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && checkoutModal?.classList.contains('active')) {
    closeCheckoutModal();
  }
});

// Form Validation & Submission
if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('studentName');
    const emailInput = document.getElementById('studentEmail');
    const phoneInput = document.getElementById('studentPhone');

    const nameErr = document.getElementById('nameError');
    const emailErr = document.getElementById('emailError');
    const phoneErr = document.getElementById('phoneError');

    // Reset errors
    if (nameErr) nameErr.textContent = '';
    if (emailErr) emailErr.textContent = '';
    if (phoneErr) phoneErr.textContent = '';
    if (formAlert) formAlert.style.display = 'none';

    let isValid = true;

    // Validate Name
    const nameVal = nameInput?.value.trim() || '';
    if (!nameVal || nameVal.length < 2) {
      if (nameErr) nameErr.textContent = 'Please enter your full name.';
      isValid = false;
    }

    // Validate Email
    const emailVal = emailInput?.value.trim() || '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      if (emailErr) emailErr.textContent = 'Please enter a valid email address.';
      isValid = false;
    }

    // Validate Phone & Country Code
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

    // Show Loading State
    if (btnText) btnText.style.display = 'none';
    if (btnSpinner) btnSpinner.style.display = 'inline-block';
    if (paySubmitBtn) paySubmitBtn.disabled = true;

    try {
      // Call Backend API to create HDFC SmartGateway Session
      const response = await fetch('/api/create-payment-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameVal,
          email: emailVal,
          phone: `${countryCodeVal}${phoneVal}`,
          isExpired: isOfferExpired
        })
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        // Redirect customer to HDFC SmartGateway Payment Link / Mock Gateway
        window.location.href = data.paymentUrl;
      } else {
        throw new Error(data.message || 'Could not initiate payment session.');
      }

    } catch (err) {
      console.error('[Checkout Error]:', err);
      if (formAlert) {
        formAlert.textContent = err.message || 'Failed to connect to HDFC Gateway. Please try again.';
        formAlert.style.display = 'block';
      }
      
      // Reset Button State
      if (btnText) btnText.style.display = 'inline-block';
      if (btnSpinner) btnSpinner.style.display = 'none';
      if (paySubmitBtn) paySubmitBtn.disabled = false;
    }
  });
}
