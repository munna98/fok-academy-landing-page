/*
  FOK Academy 10-minute introductory offer script.
  Enforces session countdown timer and responsive sticky CTA interactions.
*/

// 10-Minute Timer Logic
const OFFER_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const offerStartedAt = Date.now();
const offerExpiresAt = offerStartedAt + OFFER_DURATION;

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

// Single Open FAQ Accordion
document.querySelectorAll('.faq-list details').forEach((detail) => {
  detail.addEventListener('toggle', () => {
    if (detail.open) {
      document.querySelectorAll('.faq-list details').forEach((other) => {
        if (other !== detail) other.removeAttribute('open');
      });
    }
  });
});

// Mobile Navigation Toggle
const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');

menuBtn?.addEventListener('click', () => {
  if (!navLinks) return;
  const isVisible = navLinks.style.display === 'flex';
  navLinks.style.display = isVisible ? '' : 'flex';
  navLinks.style.position = 'absolute';
  navLinks.style.top = '76px';
  navLinks.style.left = '0';
  navLinks.style.right = '0';
  navLinks.style.padding = '20px';
  navLinks.style.background = '#fbfaf7';
  navLinks.style.flexDirection = 'column';
  navLinks.style.borderBottom = '1px solid #e5e7eb';
  navLinks.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
});

// Smooth Scroll for Nav Links & CTAs
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      e.preventDefault();
      // Close mobile menu if open
      if (navLinks && window.innerWidth <= 768) {
        navLinks.style.display = '';
      }
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
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
