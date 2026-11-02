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

  if (topCountdown) {
    topCountdown.textContent = timeString;
    topCountdown.style.display = "";
  }
  if (checkoutClock) checkoutClock.textContent = timeString;

  if (remaining <= 0) {
    isOfferExpired = true;
    if (timer) clearInterval(timer);

    const announcementText = document.querySelector(".announcement .announcement-text");
    if (announcementText) {
      announcementText.innerHTML = '<i class="fa-solid fa-clock text-gold"></i> INTRODUCTORY OFFER HAS ENDED';
    }
    if (topCountdown) {
      topCountdown.textContent = "";
      topCountdown.style.display = "none";
    }
    if (checkoutClock) checkoutClock.textContent = "00:00";
    if (checkoutPriceTag) checkoutPriceTag.textContent = "₹899";
    if (pricingNote) pricingNote.textContent = "Offer Expired. Current Price: ₹899";
    if (timerBannerLabel) timerBannerLabel.textContent = "₹499 Offer Expired";
    updateSubmitButtonAmount();
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

function getEffectivePlanAndAmount() {
  const urlParams = new URLSearchParams(window.location.search);
  const rawParam = urlParams.get('amount') || urlParams.get('plan') || '';
  const clean = rawParam.replace('tier_', '').trim();

  const checkedRadio = document.querySelector('input[name="selected_amount"]:checked');
  if (checkedRadio) {
    const amt = checkedRadio.dataset.amount || checkedRadio.value.replace('tier_', '');
    const plan = checkedRadio.value.startsWith('tier_') ? checkedRadio.value : `tier_${checkedRadio.value}`;
    return { planId: plan, amount: amt };
  }

  if (clean === '999') {
    return { planId: 'tier_999', amount: '999' };
  }
  if (clean === '899') {
    return { planId: 'tier_899', amount: '899' };
  }
  if (clean === '499') {
    if (isOfferExpired) {
      return { planId: 'tier_899', amount: '899' };
    }
    return { planId: 'tier_499', amount: '499' };
  }

  if (isOfferExpired) {
    return { planId: 'tier_899', amount: '899' };
  }
  return { planId: 'tier_499', amount: '499' };
}

function updateSubmitButtonAmount() {
  const { amount } = getEffectivePlanAndAmount();
  const paySubmitBtn = document.getElementById('paySubmitBtn');
  const btnText = paySubmitBtn?.querySelector('.btn-text');
  if (btnText) {
    btnText.textContent = `Proceed to HDFC SmartGateway (₹${amount}) →`;
  }
}

// Initial update immediately on script execution
updateSubmitButtonAmount();

// Sync Amount Selector Radios & URL Params
document.addEventListener('DOMContentLoaded', () => {
  updateSubmitButtonAmount();
  const urlParams = new URLSearchParams(window.location.search);
  const paramAmount = urlParams.get('amount');
  const amountRadios = document.querySelectorAll('input[name="selected_amount"]');

  if (paramAmount) {
    const cleanParam = paramAmount.replace('tier_', '');
    if (['499', '899', '999'].includes(cleanParam)) {
      const targetRadio = document.querySelector(`input[name="selected_amount"][value="tier_${cleanParam}"], input[name="selected_amount"][value="${cleanParam}"]`);
      if (targetRadio) targetRadio.checked = true;
    }
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

    updateSubmitButtonAmount();
  }

  amountRadios.forEach((radio) => {
    radio.addEventListener('change', updateAmountCardStyles);
  });

  updateAmountCardStyles();

  // Country / State / District conditional show-hide
  const countrySelect = document.getElementById('studentCountry');
  const stateSelect = document.getElementById('studentState');
  const districtSelect = document.getElementById('studentDistrict');
  const stateGroup = document.getElementById('stateGroup');
  const districtGroup = document.getElementById('districtGroup');

  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      const isIndia = countrySelect.value === 'India';
      if (stateGroup) {
        stateGroup.style.display = isIndia ? '' : 'none';
        if (!isIndia && stateSelect) stateSelect.value = '';
      }
      if (districtGroup) {
        districtGroup.style.display = 'none';
        if (districtSelect) districtSelect.value = '';
      }
    });
  }

  if (stateSelect) {
    stateSelect.addEventListener('change', () => {
      const isKerala = stateSelect.value === 'Kerala';
      if (districtGroup) {
        districtGroup.style.display = isKerala ? '' : 'none';
        if (!isKerala && districtSelect) districtSelect.value = '';
      }
    });
  }

  // Initialize Global Countries & Phone Formatting Controller
  initCountryAndPhoneFeatures();
});

// --- Country Selection & Phone Formatting Controller ---
function initCountryAndPhoneFeatures() {
  if (!window.FOK_COUNTRIES) {
    console.warn('FOK_COUNTRIES data not loaded');
    return;
  }

  const { all: allCountries, popular: popularCountries, getByCode, getByName, getByDial, formatPhone, validatePhone } = window.FOK_COUNTRIES;

  // DOM Elements - Present Country
  const countryContainer = document.getElementById('countrySelectContainer');
  const countryTrigger = document.getElementById('countrySelectTrigger');
  const countryValue = document.getElementById('countrySelectValue');
  const countryMenu = document.getElementById('countrySelectMenu');
  const countrySearch = document.getElementById('countrySearchInput');
  const countryClear = document.getElementById('countryClearBtn');
  const countryOptionsList = document.getElementById('countryOptionsList');
  const nativeCountrySelect = document.getElementById('studentCountry');
  const countryErr = document.getElementById('countryError');

  // DOM Elements - WhatsApp Dial Code & Phone
  const dialContainer = document.getElementById('dialCodeContainer');
  const dialTrigger = document.getElementById('dialCodeTrigger');
  const dialFlag = document.getElementById('dialCodeFlag');
  const dialDisplay = document.getElementById('dialCodeDisplay');
  const dialMenu = document.getElementById('dialCodeMenu');
  const dialSearch = document.getElementById('dialSearchInput');
  const dialClear = document.getElementById('dialClearBtn');
  const dialOptionsList = document.getElementById('dialOptionsList');
  const nativeDialSelect = document.getElementById('countryCodeSelect');
  const studentPhone = document.getElementById('studentPhone');
  const phoneErr = document.getElementById('phoneError');

  // Populate native select elements for complete backward compatibility
  if (nativeCountrySelect) {
    nativeCountrySelect.innerHTML = '';
    allCountries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = `${c.flag} ${c.name}`;
      if (c.code === 'IN') opt.selected = true;
      nativeCountrySelect.appendChild(opt);
    });
  }

  if (nativeDialSelect) {
    nativeDialSelect.innerHTML = '';
    allCountries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.dial;
      opt.textContent = `${c.flag} ${c.dial} (${c.name})`;
      if (c.code === 'IN') opt.selected = true;
      nativeDialSelect.appendChild(opt);
    });
  }

  // Active selection state
  let currentCountry = getByCode('IN') || allCountries[0];
  let currentDialCountry = getByCode('IN') || allCountries[0];
  let userManuallyChangedDial = false;

  // Render Present Country options
  function renderCountryList(query = '') {
    if (!countryOptionsList) return;
    countryOptionsList.innerHTML = '';
    const q = query.trim().toLowerCase();

    if (!q) {
      // Top Countries group
      const topTitle = document.createElement('div');
      topTitle.className = 'fok-options-group-title';
      topTitle.textContent = 'Top Countries';
      countryOptionsList.appendChild(topTitle);

      popularCountries.forEach(c => {
        countryOptionsList.appendChild(createCountryItem(c, currentCountry.code === c.code));
      });

      // All Countries group
      const allTitle = document.createElement('div');
      allTitle.className = 'fok-options-group-title';
      allTitle.textContent = 'All Countries (A-Z)';
      countryOptionsList.appendChild(allTitle);

      allCountries.forEach(c => {
        countryOptionsList.appendChild(createCountryItem(c, currentCountry.code === c.code));
      });
      return;
    }

    // Filtered and ranked by relevance
    const qDigits = q.replace(/\D/g, '');
    const scoredMatches = allCountries.map(c => {
      const name = c.name.toLowerCase();
      const code = c.code.toLowerCase();
      const dialDigits = c.dial.replace(/\D/g, '');
      let score = 0;

      if (name === q) score += 100;
      else if (name.startsWith(q)) score += 60;
      else if (name.includes(' ' + q)) score += 35;
      else if (name.includes(q)) score += 15;

      if (code === q) score += 85;

      if (qDigits && dialDigits === qDigits) score += 95;
      else if (qDigits && dialDigits.startsWith(qDigits)) score += 45;
      else if (qDigits && dialDigits.includes(qDigits)) score += 20;

      if (c.keywords) {
        c.keywords.forEach(k => {
          const kl = k.toLowerCase();
          if (kl === q) score += 80;
          else if (kl.startsWith(q)) score += 40;
          else if (kl.includes(q)) score += 15;
        });
      }

      return { country: c, score };
    }).filter(item => item.score > 0);

    scoredMatches.sort((a, b) => b.score - a.score || a.country.name.localeCompare(b.country.name));
    const matches = scoredMatches.map(item => item.country);

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fok-select-empty';
      empty.innerHTML = `<i class="fa-regular fa-face-frown" style="font-size: 18px; margin-bottom: 6px; display: block;"></i> No country found matching "${escapeHtml(query)}"`;
      countryOptionsList.appendChild(empty);
    } else {
      matches.forEach(c => {
        countryOptionsList.appendChild(createCountryItem(c, currentCountry.code === c.code));
      });
    }
  }

  function createCountryItem(c, isSelected) {
    const item = document.createElement('div');
    item.className = `fok-option-item ${isSelected ? 'is-selected' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    item.dataset.code = c.code;

    item.innerHTML = `
      <div class="fok-option-content">
        <span class="fok-option-flag">${c.flag}</span>
        <span class="fok-option-name">${c.name}</span>
      </div>
      <span class="fok-option-dial">${c.dial}</span>
      ${isSelected ? '<i class="fa-solid fa-check fok-option-check"></i>' : ''}
    `;

    item.addEventListener('click', () => {
      selectCountry(c);
      closeCountryDropdown();
    });

    return item;
  }

  function selectCountry(country) {
    currentCountry = country;
    if (countryValue) {
      countryValue.innerHTML = `<span class="country-flag">${country.flag}</span><span class="country-name">${country.name}</span>`;
    }
    if (nativeCountrySelect) {
      nativeCountrySelect.value = country.name;
      nativeCountrySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (countryErr) countryErr.textContent = '';

    // Smart Sync: automatically sync WhatsApp country code if user hasn't explicitly customized it independently
    if (!userManuallyChangedDial || currentDialCountry.code === 'IN') {
      selectDialCountry(country, false);
    }
  }

  function openCountryDropdown() {
    closeDialDropdown();
    if (countryContainer) countryContainer.classList.add('is-open');
    if (countryMenu) countryMenu.style.display = 'flex';
    if (countryTrigger) countryTrigger.setAttribute('aria-expanded', 'true');
    renderCountryList(countrySearch ? countrySearch.value : '');
    if (countrySearch) {
      countrySearch.focus();
      setTimeout(() => {
        const selected = countryOptionsList?.querySelector('.fok-option-item.is-selected');
        if (selected) {
          selected.scrollIntoView({ block: 'nearest' });
        }
      }, 50);
    }
  }

  function closeCountryDropdown() {
    if (countryContainer) countryContainer.classList.remove('is-open');
    if (countryMenu) countryMenu.style.display = 'none';
    if (countryTrigger) countryTrigger.setAttribute('aria-expanded', 'false');
    if (countrySearch) {
      countrySearch.value = '';
      if (countryClear) countryClear.style.display = 'none';
    }
  }

  if (countryTrigger) {
    countryTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = countryContainer?.classList.contains('is-open');
      if (isOpen) {
        closeCountryDropdown();
      } else {
        openCountryDropdown();
      }
    });
  }

  if (countrySearch) {
    countrySearch.addEventListener('input', () => {
      const val = countrySearch.value;
      if (countryClear) countryClear.style.display = val ? 'flex' : 'none';
      renderCountryList(val);
    });

    countrySearch.addEventListener('keydown', (e) => {
      handleDropdownKeydown(e, countryOptionsList, (item) => {
        const code = item.dataset.code;
        const found = getByCode(code);
        if (found) {
          selectCountry(found);
          closeCountryDropdown();
          countryTrigger?.focus();
        }
      }, closeCountryDropdown);
    });
  }

  if (countryClear) {
    countryClear.addEventListener('click', () => {
      if (countrySearch) {
        countrySearch.value = '';
        countrySearch.focus();
        countryClear.style.display = 'none';
        renderCountryList('');
      }
    });
  }

  // --- Render WhatsApp Dial Code options ---
  function renderDialList(query = '') {
    if (!dialOptionsList) return;
    dialOptionsList.innerHTML = '';
    const q = query.trim().toLowerCase().replace(/^\+/, '');

    if (!q) {
      // Top Dial Codes
      const topTitle = document.createElement('div');
      topTitle.className = 'fok-options-group-title';
      topTitle.textContent = 'Popular Codes';
      dialOptionsList.appendChild(topTitle);

      popularCountries.forEach(c => {
        dialOptionsList.appendChild(createDialItem(c, currentDialCountry.code === c.code));
      });

      // All Codes
      const allTitle = document.createElement('div');
      allTitle.className = 'fok-options-group-title';
      allTitle.textContent = 'All Country Codes (A-Z)';
      dialOptionsList.appendChild(allTitle);

      allCountries.forEach(c => {
        dialOptionsList.appendChild(createDialItem(c, currentDialCountry.code === c.code));
      });
      return;
    }

    // Filtered and ranked by relevance
    const qDigits = q.replace(/\D/g, '');
    const scoredMatches = allCountries.map(c => {
      const name = c.name.toLowerCase();
      const code = c.code.toLowerCase();
      const dialDigits = c.dial.replace(/\D/g, '');
      let score = 0;

      if (qDigits && dialDigits === qDigits) score += 100;
      else if (qDigits && dialDigits.startsWith(qDigits)) score += 60;
      else if (qDigits && dialDigits.includes(qDigits)) score += 20;

      if (name === q) score += 80;
      else if (name.startsWith(q)) score += 50;
      else if (name.includes(' ' + q)) score += 30;
      else if (name.includes(q)) score += 10;

      if (code === q) score += 70;

      if (c.keywords) {
        c.keywords.forEach(k => {
          const kl = k.toLowerCase();
          if (kl === q) score += 75;
          else if (kl.startsWith(q)) score += 35;
          else if (kl.includes(q)) score += 15;
        });
      }

      return { country: c, score };
    }).filter(item => item.score > 0);

    scoredMatches.sort((a, b) => b.score - a.score || a.country.name.localeCompare(b.country.name));
    const matches = scoredMatches.map(item => item.country);

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fok-select-empty';
      empty.innerHTML = `<i class="fa-regular fa-face-frown" style="font-size: 18px; margin-bottom: 6px; display: block;"></i> No country code found matching "${escapeHtml(query)}"`;
      dialOptionsList.appendChild(empty);
    } else {
      matches.forEach(c => {
        dialOptionsList.appendChild(createDialItem(c, currentDialCountry.code === c.code));
      });
    }
  }

  function createDialItem(c, isSelected) {
    const item = document.createElement('div');
    item.className = `fok-option-item ${isSelected ? 'is-selected' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    item.dataset.code = c.code;

    item.innerHTML = `
      <div class="fok-option-content">
        <span class="fok-option-flag">${c.flag}</span>
        <span class="fok-option-name">${c.name}</span>
      </div>
      <span class="fok-option-dial">${c.dial}</span>
      ${isSelected ? '<i class="fa-solid fa-check fok-option-check"></i>' : ''}
    `;

    item.addEventListener('click', () => {
      selectDialCountry(c, true);
      closeDialDropdown();
      if (studentPhone) studentPhone.focus();
    });

    return item;
  }

  function selectDialCountry(country, isManualUserChoice = true) {
    if (isManualUserChoice) {
      userManuallyChangedDial = true;
    }
    currentDialCountry = country;
    if (dialFlag) dialFlag.textContent = country.flag;
    if (dialDisplay) dialDisplay.textContent = country.dial;
    if (nativeDialSelect) {
      nativeDialSelect.value = country.dial;
      nativeDialSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (studentPhone) {
      studentPhone.placeholder = country.placeholder || 'Mobile number';
      const maxDigits = country.lengths ? Math.max(...country.lengths) : 15;
      studentPhone.maxLength = (country.format ? country.format.length : maxDigits) + 3;

      // Reformat existing digits in accordance with the newly selected country
      if (studentPhone.value) {
        const raw = studentPhone.value.replace(/\D/g, '');
        studentPhone.value = formatPhone(raw, country);
      }
    }

    if (phoneErr) phoneErr.textContent = '';
  }

  function openDialDropdown() {
    closeCountryDropdown();
    if (dialContainer) dialContainer.classList.add('is-open');
    if (dialMenu) dialMenu.style.display = 'flex';
    if (dialTrigger) dialTrigger.setAttribute('aria-expanded', 'true');
    renderDialList(dialSearch ? dialSearch.value : '');
    if (dialSearch) {
      dialSearch.focus();
      setTimeout(() => {
        const selected = dialOptionsList?.querySelector('.fok-option-item.is-selected');
        if (selected) {
          selected.scrollIntoView({ block: 'nearest' });
        }
      }, 50);
    }
  }

  function closeDialDropdown() {
    if (dialContainer) dialContainer.classList.remove('is-open');
    if (dialMenu) dialMenu.style.display = 'none';
    if (dialTrigger) dialTrigger.setAttribute('aria-expanded', 'false');
    if (dialSearch) {
      dialSearch.value = '';
      if (dialClear) dialClear.style.display = 'none';
    }
  }

  if (dialTrigger) {
    dialTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = dialContainer?.classList.contains('is-open');
      if (isOpen) {
        closeDialDropdown();
      } else {
        openDialDropdown();
      }
    });
  }

  if (dialSearch) {
    dialSearch.addEventListener('input', () => {
      const val = dialSearch.value;
      if (dialClear) dialClear.style.display = val ? 'flex' : 'none';
      renderDialList(val);
    });

    dialSearch.addEventListener('keydown', (e) => {
      handleDropdownKeydown(e, dialOptionsList, (item) => {
        const code = item.dataset.code;
        const found = getByCode(code);
        if (found) {
          selectDialCountry(found, true);
          closeDialDropdown();
          studentPhone?.focus();
        }
      }, closeDialDropdown);
    });
  }

  if (dialClear) {
    dialClear.addEventListener('click', () => {
      if (dialSearch) {
        dialSearch.value = '';
        dialSearch.focus();
        dialClear.style.display = 'none';
        renderDialList('');
      }
    });
  }

  // Keyboard navigation inside dropdowns
  function handleDropdownKeydown(e, listEl, onSelect, onClose) {
    if (!listEl) return;
    const items = Array.from(listEl.querySelectorAll('.fok-option-item'));
    if (!items.length) return;

    let highlightedIdx = items.findIndex(el => el.classList.contains('is-highlighted'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (highlightedIdx >= 0) items[highlightedIdx].classList.remove('is-highlighted');
      highlightedIdx = (highlightedIdx + 1) % items.length;
      items[highlightedIdx].classList.add('is-highlighted');
      items[highlightedIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (highlightedIdx >= 0) items[highlightedIdx].classList.remove('is-highlighted');
      highlightedIdx = (highlightedIdx - 1 + items.length) % items.length;
      items[highlightedIdx].classList.add('is-highlighted');
      items[highlightedIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = highlightedIdx >= 0 ? items[highlightedIdx] : items[0];
      if (target) onSelect(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (countryContainer && !countryContainer.contains(e.target)) {
      closeCountryDropdown();
    }
    if (dialContainer && !dialContainer.contains(e.target)) {
      closeDialDropdown();
    }
  });

  // --- Real-time Mobile Number Formatting in accordance with Country Code ---
  if (studentPhone) {
    studentPhone.placeholder = currentDialCountry.placeholder || '98765 43210';
    const maxDigits = currentDialCountry.lengths ? Math.max(...currentDialCountry.lengths) : 15;
    studentPhone.maxLength = (currentDialCountry.format ? currentDialCountry.format.length : maxDigits) + 3;

    studentPhone.addEventListener('input', () => {
      const val = studentPhone.value;
      const cursorPos = studentPhone.selectionStart || 0;
      const digitsBefore = (val.slice(0, cursorPos).match(/\d/g) || []).length;

      let clean = val.replace(/\D/g, '');

      // Check if user typed/pasted number starting with current dial code (e.g. 919876543210 for IN)
      const dialDigits = currentDialCountry.dial.replace(/\D/g, '');
      const maxLen = currentDialCountry.lengths ? Math.max(...currentDialCountry.lengths) : 15;
      if (clean.startsWith(dialDigits) && clean.length > maxLen) {
        clean = clean.slice(dialDigits.length);
      }

      // Check if user entered leading trunk 0 for countries where mobile is national without 0 (e.g. UAE 050..., UK 07...)
      if (clean.startsWith('0') && currentDialCountry.lengths && clean.length > Math.max(...currentDialCountry.lengths)) {
        clean = clean.slice(1);
      }

      // Cap digits
      if (clean.length > maxLen) {
        clean = clean.slice(0, maxLen);
      }

      const formatted = formatPhone(clean, currentDialCountry);
      studentPhone.value = formatted;

      // Restore cursor position accurately
      let newPos = 0;
      let counted = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          counted++;
        }
        if (counted === digitsBefore) {
          newPos = i + 1;
          break;
        }
      }
      if (digitsBefore === 0) newPos = 0;
      if (counted < digitsBefore) newPos = formatted.length;
      studentPhone.setSelectionRange(newPos, newPos);

      // Clear error once valid
      if (phoneErr && phoneErr.textContent) {
        const chk = validatePhone(clean, currentDialCountry);
        if (chk.valid) phoneErr.textContent = '';
      }
    });

    studentPhone.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && studentPhone.selectionStart === studentPhone.selectionEnd) {
        const pos = studentPhone.selectionStart;
        const val = studentPhone.value;
        if (pos > 0 && /\D/.test(val[pos - 1])) {
          e.preventDefault();
          let targetDigit = pos - 1;
          while (targetDigit >= 0 && /\D/.test(val[targetDigit])) {
            targetDigit--;
          }
          if (targetDigit >= 0) {
            const newVal = val.slice(0, targetDigit) + val.slice(targetDigit + 1);
            const digitsBefore = (val.slice(0, targetDigit).match(/\d/g) || []).length;
            const clean = newVal.replace(/\D/g, '');
            const formatted = formatPhone(clean, currentDialCountry);
            studentPhone.value = formatted;

            let newPos = 0;
            let counted = 0;
            for (let i = 0; i < formatted.length; i++) {
              if (/\d/.test(formatted[i])) {
                counted++;
              }
              if (counted === digitsBefore) {
                newPos = i + 1;
                break;
              }
            }
            studentPhone.setSelectionRange(newPos, newPos);
          }
        }
      }
    });

    studentPhone.addEventListener('paste', (e) => {
      const pasteText = (e.clipboardData || window.clipboardData).getData('text') || '';
      const trimmed = pasteText.trim();
      if (trimmed.startsWith('+')) {
        for (const c of allCountries) {
          if (trimmed.startsWith(c.dial)) {
            e.preventDefault();
            selectDialCountry(c, true);
            const rem = trimmed.slice(c.dial.length).replace(/\D/g, '');
            studentPhone.value = formatPhone(rem, c);
            return;
          }
        }
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Export current country getter for submit validation
  window.__getCheckoutCountryState = () => ({
    country: currentCountry,
    dialCountry: currentDialCountry
  });
}

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

    const countryState = (typeof window.__getCheckoutCountryState === 'function')
      ? window.__getCheckoutCountryState()
      : { country: null, dialCountry: null };
    const activeDialCountry = countryState.dialCountry || (window.FOK_COUNTRIES ? window.FOK_COUNTRIES.getByDial(countryCodeVal) : null);

    if (window.FOK_COUNTRIES && activeDialCountry) {
      const phoneValidation = window.FOK_COUNTRIES.validatePhone(phoneVal, activeDialCountry);
      if (!phoneValidation.valid) {
        if (phoneErr) phoneErr.textContent = phoneValidation.message;
        isValid = false;
      }
    } else {
      if (countryCodeVal === '+91' && phoneVal.length !== 10) {
        if (phoneErr) phoneErr.textContent = 'Please enter a valid 10-digit mobile number.';
        isValid = false;
      } else if (phoneVal.length < 6 || phoneVal.length > 15) {
        if (phoneErr) phoneErr.textContent = 'Please enter a valid mobile number.';
        isValid = false;
      }
    }

    // Location fields
    const countryInput = document.getElementById('studentCountry');
    const stateInput = document.getElementById('studentState');
    const districtInput = document.getElementById('studentDistrict');
    const countryErr = document.getElementById('countryError');
    const stateErr = document.getElementById('stateError');
    const districtErr = document.getElementById('districtError');

    if (countryErr) countryErr.textContent = '';
    if (stateErr) stateErr.textContent = '';
    if (districtErr) districtErr.textContent = '';

    const countryVal = countryInput?.value || '';
    if (!countryVal) {
      if (countryErr) countryErr.textContent = 'Please select your present country.';
      isValid = false;
    }

    const stateVal = (countryVal === 'India' && stateInput?.value) ? stateInput.value : '';
    if (countryVal === 'India' && !stateVal) {
      if (stateErr) stateErr.textContent = 'Please select your state.';
      isValid = false;
    }

    const districtVal = (stateVal === 'Kerala' && districtInput?.value) ? districtInput.value : '';
    if (stateVal === 'Kerala' && !districtVal) {
      if (districtErr) districtErr.textContent = 'Please select your district.';
      isValid = false;
    }

    if (!isValid) return;

    if (btnText) btnText.style.display = 'none';
    if (btnSpinner) btnSpinner.style.display = 'inline-block';
    if (paySubmitBtn) paySubmitBtn.disabled = true;

    const { planId: selectedPlan } = getEffectivePlanAndAmount();

    try {
      // Step 1: Obtain tamper-proof HMAC-signed session token for the selected plan tier
      const sessionRes = await fetch('/api/initiate-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          isExpired: isOfferExpired
        })
      });
      const sessionData = await sessionRes.json();
      if (!sessionData.success || !sessionData.sessionToken) {
        throw new Error(sessionData.message || 'Unable to establish secure checkout session.');
      }

      // Step 2: Initiate HDFC Payment Order using the cryptographic session token
      const response = await fetch('/api/create-payment-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameVal,
          email: emailVal,
          phone: `${countryCodeVal}${phoneVal}`,
          country: countryVal,
          state: stateVal || null,
          district: districtVal || null,
          sessionToken: sessionData.sessionToken
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

