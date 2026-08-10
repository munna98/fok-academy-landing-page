/*
  FOK Academy 10-minute introductory offer.
  IMPORTANT: This is a browser-session countdown. For a real campaign,
  the deadline/price should also be enforced by the checkout/backend.
*/

const OFFER_DURATION = 10 * 60 * 1000;
const offerStartedAt = Date.now();
const offerExpiresAt = offerStartedAt + OFFER_DURATION;

const topCountdown = document.getElementById("topCountdown");
const minutesEl = document.getElementById("minutes");
const secondsEl = document.getElementById("seconds");
const priceEl = document.getElementById("coursePrice");
const statusEl = document.getElementById("offerStatus");
const enrollButton = document.getElementById("enrollButton");
const priceCard = document.querySelector(".price-card");

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

    priceEl.innerHTML = '₹899 <small>one time</small>';
    statusEl.textContent = "The ₹499 introductory offer has expired. Current price: ₹899.";
    enrollButton.textContent = "Enroll for ₹899 →";
    priceCard?.classList.add("expired");
  }
}

updateCountdown();
const timer = setInterval(updateCountdown, 250);

// FAQ accordion
document.querySelectorAll('.faq-list details').forEach((detail) => {
  detail.addEventListener('toggle', () => {
    if (detail.open) {
      document.querySelectorAll('.faq-list details').forEach((other) => {
        if (other !== detail) other.removeAttribute('open');
      });
    }
  });
});

// Mobile navigation
const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');

menuBtn?.addEventListener('click', () => {
  navLinks.style.display = navLinks.style.display === 'flex' ? '' : 'flex';
  navLinks.style.position = 'absolute';
  navLinks.style.top = '76px';
  navLinks.style.left = '0';
  navLinks.style.right = '0';
  navLinks.style.padding = '20px';
  navLinks.style.background = '#fbfaf7';
  navLinks.style.flexDirection = 'column';
  navLinks.style.borderBottom = '1px solid #e5e7eb';
});
