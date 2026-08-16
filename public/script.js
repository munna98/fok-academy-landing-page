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
