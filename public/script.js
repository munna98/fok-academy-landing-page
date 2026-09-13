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

let timer = null;

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
    if (timer) clearInterval(timer);

    if (topCountdown) topCountdown.textContent = "EXPIRED";
    if (minutesEl) minutesEl.textContent = "00";
    if (secondsEl) secondsEl.textContent = "00";

    if (priceEl) priceEl.innerHTML = '₹899 <small>one time</small>';
    if (statusEl) statusEl.textContent = "The ₹499 introductory offer has expired. Current price: ₹899.";
    if (enrollButton) enrollButton.textContent = "Enroll for ₹899 →";
    if (priceCard) priceCard.classList.add("expired");

    if (mobileStickyCta) {
      const priceText = mobileStickyCta.querySelector(".mobile-cta-info span");
      if (priceText) priceText.innerHTML = "₹899";
    }
  }
}

updateCountdown();
timer = setInterval(updateCountdown, 250);

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

// 4. Video Cards — Hybrid: Auto-scroll marquee on desktop, swipe snap-scroll on mobile
const marqueeWrapper = document.getElementById('videoMarqueeWrapper');
const marqueeTrack  = document.getElementById('videoMarqueeTrack');

const MOBILE_BP = 768;
function isMobile() {
  return window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches;
}

// Desktop: pause/resume marquee on hover
function pauseMarquee() {
  if (marqueeTrack) marqueeTrack.style.animationPlayState = 'paused';
}
function resumeMarquee() {
  if (marqueeTrack) marqueeTrack.style.animationPlayState = 'running';
}

document.querySelectorAll('.video-card').forEach((card) => {
  card.addEventListener('mouseenter', () => { if (!isMobile()) pauseMarquee(); });
  card.addEventListener('mouseleave', () => { if (!isMobile()) resumeMarquee(); });
});

// Mobile: seamless infinite loop
// Keep all 10 cards (5 originals + 5 duplicates).
// When user scrolls into the duplicate set (second half), silently jump
// back to the equivalent position in the first half — no flash, seamless loop.
const REAL_COUNT = 5;
let loopLocked = false;

function getMobileGap() {
  if (!marqueeTrack) return 16;
  return parseFloat(getComputedStyle(marqueeTrack).gap) || 16;
}

function getHalfScrollWidth() {
  const card = marqueeTrack && marqueeTrack.querySelector('.video-card');
  if (!card) return 0;
  const cw  = card.offsetWidth;
  const gap = getMobileGap();
  return REAL_COUNT * (cw + gap);
}

function initMobileScroll() {
  if (!marqueeWrapper) return;
  marqueeWrapper.scrollLeft = 0;
}

function onMobileScroll() {
  if (loopLocked || !marqueeWrapper) return;
  const halfWidth = getHalfScrollWidth();
  if (halfWidth === 0) return;
  const sl = marqueeWrapper.scrollLeft;

  if (sl >= halfWidth) {
    loopLocked = true;
    marqueeWrapper.style.scrollSnapType = 'none';
    marqueeWrapper.scrollLeft = sl - halfWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        marqueeWrapper.style.scrollSnapType = '';
        loopLocked = false;
      });
    });
  }
}

function handleLayout() {
  if (isMobile()) {
    if (marqueeTrack) marqueeTrack.style.animation = 'none';
    initMobileScroll();
  } else {
    if (marqueeTrack) marqueeTrack.style.animation = '';
  }
}

if (marqueeWrapper) {
  marqueeWrapper.addEventListener('scroll', () => {
    if (isMobile()) onMobileScroll();
  }, { passive: true });
}

handleLayout();
window.addEventListener('resize', handleLayout);
