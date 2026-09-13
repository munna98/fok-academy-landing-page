const fs = require('fs');
const p = 'D:\\My projects\\fok-academy-landing-page\\public\\index.html';
let c = fs.readFileSync(p, 'utf8');

// Remove the hint/dots block using a regex
const updated = c.replace(
  /\s*<!-- Desktop hint[\s\S]*?<\/div>\s*<!-- Mobile swipe hint[\s\S]*?<\/div>\s*<div class="scroll-dots"[\s\S]*?<\/div>/,
  ''
);
console.log('Changed:', c !== updated);
fs.writeFileSync(p, updated, 'utf8');
console.log('Done');
