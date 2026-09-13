const fs = require('fs');
const p = 'D:\\My projects\\fok-academy-landing-page\\public\\script.js';
let c = fs.readFileSync(p, 'utf8');

// Find start index of section 4
const startMarker = '// 4. Video Cards';
const startIdx = c.indexOf(startMarker);
if (startIdx === -1) { console.error('Start marker not found'); process.exit(1); }

const newSection = `// 4. Video Cards — Hybrid: Auto-scroll marquee on desktop, swipe snap-scroll on mobile
const marqueeWrapper = document.getElementById('videoMarqueeWrapper');
const marqueeTrack  = document.getElementById('videoMarqueeTrack');

const MOBILE_BP = 768;
function isMobile() {
  return window.matchMedia(\`(max-width: \${MOBILE_BP}px)\`).matches;
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
`;

const updated = c.slice(0, startIdx) + newSection;
console.log('New length:', updated.length, 'Original:', c.length);
fs.writeFileSync(p, updated, 'utf8');
console.log('Done');
