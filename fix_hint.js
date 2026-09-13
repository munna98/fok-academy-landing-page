const fs = require('fs');
const path = require('path');
const filePath = path.join('D:\\My projects\\fok-academy-landing-page\\public\\index.html');
const content = fs.readFileSync(filePath, 'utf8');
const old = '      <div class="marquee-hint"><i class="fa-solid fa-hand-pointer text-gold"></i> Hover or tap any video card to pause & watch attendee experience</div>';
console.log('OLD FOUND:', content.includes(old));
const newHtml = `      <!-- Desktop hint (hidden on mobile) -->
      <div class="marquee-hint desktop-marquee-hint"><i class="fa-solid fa-arrows-left-right text-gold"></i> Auto-scrolling &mdash; hover to pause</div>
      <!-- Mobile swipe hint + dot indicators (hidden on desktop) -->
      <div class="mobile-scroll-hint" id="mobileScrollHint">
        <i class="fa-solid fa-hand-pointer text-gold"></i> Swipe to explore reviews
      </div>
      <div class="scroll-dots" id="scrollDots">
        <span class="scroll-dot active" data-index="0"></span>
        <span class="scroll-dot" data-index="1"></span>
        <span class="scroll-dot" data-index="2"></span>
        <span class="scroll-dot" data-index="3"></span>
        <span class="scroll-dot" data-index="4"></span>
      </div>`;
const updated = content.replace(old, newHtml);
console.log('CHANGED:', content !== updated);
fs.writeFileSync(filePath, updated, 'utf8');
console.log('Done');
