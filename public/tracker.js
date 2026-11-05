/**
 * FOK Academy Traffic & Campaign Attribution Tracker
 * - Automatically tracks UTM parameters, ad click IDs (fbclid, gclid), and referrers
 * - Accurately differentiates Meta/Instagram Ads vs Instagram Organic
 * - Persists attribution across page transitions and multi-day visits (First & Last Touch)
 */
(function() {
  const FIRST_TOUCH_KEY = 'fok_attribution_first';
  const LAST_TOUCH_KEY = 'fok_attribution_last';
  const SESSION_KEY = 'fok_attribution_session';

  function parseQueryParams(urlStr) {
    try {
      const url = new URL(urlStr || window.location.href);
      const params = {};
      url.searchParams.forEach((val, key) => {
        params[key.toLowerCase()] = val;
      });
      return params;
    } catch (e) {
      return {};
    }
  }

  function getDomain(urlStr) {
    try {
      if (!urlStr) return '';
      const u = new URL(urlStr);
      return u.hostname.toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function detectTrafficSource(params, referrer) {
    const utmSource = (params.utm_source || '').trim().toLowerCase();
    const utmMedium = (params.utm_medium || '').trim().toLowerCase();
    const fbclid = (params.fbclid || '').trim();
    const gclid = (params.gclid || '').trim();
    const refDomain = getDomain(referrer);

    const isPaidMedium = /^(meta_ad|cpc|paid|paid_social|ad|ads|sponsored|ppc|facebook_ad|instagram_ad)$/i.test(utmMedium);
    const isOrganicMedium = /^(bio|organic|story|reels|profile|dm|post|free|social)$/i.test(utmMedium);

    // 1. Meta / Instagram / Facebook Ads
    const isMetaSource = /^(meta|instagram|facebook|ig|fb)$/i.test(utmSource);
    if ((isMetaSource && isPaidMedium) || (fbclid && !isOrganicMedium)) {
      if (utmSource === 'instagram' || refDomain.includes('instagram')) {
        return 'Meta Ads (Instagram)';
      }
      if (utmSource === 'facebook' || refDomain.includes('facebook')) {
        return 'Meta Ads (Facebook)';
      }
      return 'Meta Ads';
    }

    // 2. Instagram Organic
    if (utmSource === 'instagram' || utmSource === 'ig' || refDomain.includes('instagram.com')) {
      if (utmMedium === 'bio') return 'Instagram Bio';
      if (utmMedium === 'story' || utmMedium === 'organic_story') return 'Instagram Story';
      if (utmMedium === 'reels') return 'Instagram Reels';
      return 'Instagram Organic';
    }

    // 3. Facebook Organic
    if (utmSource === 'facebook' || utmSource === 'fb' || refDomain.includes('facebook.com') || refDomain.includes('fb.me')) {
      return 'Facebook Organic';
    }

    // 4. Google Ads
    if (gclid || (utmSource === 'google' && isPaidMedium)) {
      return 'Google Ads';
    }

    // 5. Google Organic / Search
    if (utmSource === 'google' || refDomain.includes('google.')) {
      return 'Google Search';
    }

    // 6. YouTube
    if (utmSource === 'youtube' || refDomain.includes('youtube.com') || refDomain.includes('youtu.be')) {
      return 'YouTube';
    }

    // 7. WhatsApp
    if (utmSource === 'whatsapp' || refDomain.includes('whatsapp.com')) {
      return 'WhatsApp';
    }

    // 8. Other Custom Campaign
    if (utmSource) {
      return utmMedium ? `${utmSource} / ${utmMedium}` : utmSource;
    }

    // 9. Other External Referral
    if (refDomain && !refDomain.includes(window.location.hostname)) {
      return `Referral: ${refDomain.replace(/^www\./, '')}`;
    }

    // 10. Direct
    return 'Direct';
  }

  function initTracker() {
    try {
      const params = parseQueryParams();
      const referrer = document.referrer || '';
      const currentHost = window.location.hostname;
      const refHost = getDomain(referrer);
      const isInternalNavigation = Boolean(refHost && (refHost === currentHost || refHost.endsWith('.' + currentHost)));

      const hasUTMs = Boolean(params.utm_source || params.utm_medium || params.utm_campaign || params.fbclid || params.gclid);
      const isExternalReferrer = Boolean(referrer && !isInternalNavigation);

      // Extract raw attribution object
      const detectedSource = detectTrafficSource(params, isInternalNavigation ? '' : referrer);
      const currentAttribution = {
        traffic_source: detectedSource,
        utm_source: params.utm_source || '',
        utm_medium: params.utm_medium || '',
        utm_campaign: params.utm_campaign || '',
        utm_content: params.utm_content || '',
        utm_term: params.utm_term || '',
        fbclid: params.fbclid || '',
        gclid: params.gclid || '',
        referrer_url: isInternalNavigation ? '' : referrer,
        landing_page: window.location.href,
        captured_at: new Date().toISOString()
      };

      // Handle First Touch (persist indefinitely unless storage cleared)
      let firstTouch = null;
      try {
        const storedFirst = localStorage.getItem(FIRST_TOUCH_KEY);
        if (storedFirst) {
          firstTouch = JSON.parse(storedFirst);
        }
      } catch (e) {}

      // If user came with marketing params or from external referrer, or no first touch recorded yet:
      if (!firstTouch || (hasUTMs && firstTouch.traffic_source === 'Direct')) {
        firstTouch = currentAttribution;
        try {
          localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
        } catch (e) {}
      }

      // Handle Last Touch & Session Touch
      let sessionTouch = null;
      try {
        const storedSession = sessionStorage.getItem(SESSION_KEY);
        if (storedSession) {
          sessionTouch = JSON.parse(storedSession);
        }
      } catch (e) {}

      // If this page load brought new campaign params or external referral:
      if (hasUTMs || isExternalReferrer || !sessionTouch) {
        sessionTouch = currentAttribution;
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionTouch));
          localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(sessionTouch));
        } catch (e) {}
      }

      // Expose globally
      window.FOK_TRACKER = {
        getAttribution: function() {
          let session = null;
          let first = null;
          try {
            session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
            first = JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || 'null');
          } catch (e) {}

          // Priority: Active campaign in session -> First touch with campaign -> Session -> Default
          if (session && session.traffic_source && session.traffic_source !== 'Direct') {
            return session;
          }
          if (first && first.traffic_source && first.traffic_source !== 'Direct') {
            return first;
          }
          return session || first || currentAttribution;
        },
        getFirstTouch: function() {
          try {
            return JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || 'null');
          } catch (e) { return null; }
        },
        getLastTouch: function() {
          try {
            return JSON.parse(localStorage.getItem(LAST_TOUCH_KEY) || 'null');
          } catch (e) { return null; }
        }
      };

      // Automatically preserve query parameters when clicking to checkout links
      if (typeof document !== 'undefined') {
        const syncParamsToUrl = function(anchor) {
          if (!anchor || !hasUTMs) return;
          try {
            const url = new URL(anchor.href, window.location.origin);
            const curParams = new URLSearchParams(window.location.search);
            curParams.forEach((v, k) => {
              if (!url.searchParams.has(k)) {
                url.searchParams.set(k, v);
              }
            });
            anchor.href = url.toString();
          } catch (err) {}
        };

        // Capture-phase click listener ensures query params are attached even for dynamically modified links
        document.addEventListener('click', function(e) {
          const anchor = e.target.closest('a[href*="checkout"]');
          if (anchor) syncParamsToUrl(anchor);
        }, true);

        const preserveParams = function() {
          if (!hasUTMs) return;
          try {
            const links = document.querySelectorAll('a[href*="checkout"]');
            links.forEach(syncParamsToUrl);
          } catch (e) {}
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', preserveParams);
        } else {
          preserveParams();
        }
      }

    } catch (err) {
      console.warn('[FOK Tracker Init Error]:', err);
    }
  }

  initTracker();
})();
