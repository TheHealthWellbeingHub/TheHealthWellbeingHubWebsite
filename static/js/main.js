(function () {
  'use strict';
  document.documentElement.classList.add('js');
  window.dataLayer = window.dataLayer || [];

  /* ---- Mobile nav toggle ---- */
  var navToggle = document.getElementById('nav-toggle');
  var navMenu = document.getElementById('nav-menu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      var open = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    navMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- Audience tabs (progressive enhancement over always-visible panels) ---- */
  var audTabs = document.querySelectorAll('.aud-tab');
  if (audTabs.length) {
    var firstPanel = document.querySelector('.aud-panel');
    if (firstPanel) firstPanel.classList.add('active');
    audTabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-target');
        document.querySelectorAll('.aud-panel').forEach(function (p) { p.classList.remove('active'); });
        document.querySelectorAll('.aud-tab').forEach(function (t) { t.classList.remove('active'); });
        var panel = document.getElementById(id);
        if (panel) panel.classList.add('active');
        btn.classList.add('active');
      });
    });
  }

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (entry.isIntersecting) {
          setTimeout(function () { entry.target.classList.add('visible'); }, i * 60);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(function (el) { obs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ---- Stat counters ---- */
  function animateCounters() {
    document.querySelectorAll('.stat-num[data-target]').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-target'), 10);
      var current = 0;
      var increment = target / 45;
      var timer = setInterval(function () {
        current += increment;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = Math.floor(current) + (target >= 20 ? '+' : '');
      }, 35);
    });
  }
  var statsEl = document.querySelector('.stats-band');
  if (statsEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) animateCounters();
    }, { threshold: 0.5 }).observe(statsEl);
  }

  /* ---- Conversion tracking ----
     Every trackable element carries data-track="<event_name>" and an
     optional data-track-location. Events land in window.dataLayer so a
     GTM trigger (Trigger type: Custom Event, matching event name) can
     forward them to GA4 and Google Ads without any code changes here. */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (!el) return;
    window.dataLayer.push({
      event: el.getAttribute('data-track'),
      link_location: el.getAttribute('data-track-location') || '',
      link_url: el.getAttribute('href') || ''
    });
  });

  /* ---- Enquiry / referral forms ----
     On submit we:
       1) push an `enquiry_submitted`/`referral_submitted` dataLayer event
          (GTM/GA4/Ads hook),
       2) POST to FORM_ENDPOINT — a serverless function (api/hubspot-submit.js)
          that creates the Contact/Deal/Note/follow-up Task in HubSpot,
       3) always fall back to opening a pre-filled mailto: to the studio
          inbox if that call fails, so an enquiry is never silently lost. */
  var FORM_ENDPOINT = '/api/hubspot-submit';
  var ENQUIRY_EMAIL = 'thehealthwellbeinghub@gmail.com';

  function formDataToJson(form) {
    var obj = {};
    new FormData(form).forEach(function (value, key) { obj[key] = value; });
    return obj;
  }

  function buildMailto(form, subjectPrefix) {
    var data = new FormData(form);
    var lines = [];
    data.forEach(function (value, key) {
      if (key === 'privacy_consent' || key === 'participant_consent_confirmed') return;
      if (!value) return;
      var label = key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      lines.push(label + ': ' + value);
    });
    // Consent is a checkbox, so an unticked box is simply absent from the
    // FormData. State it either way — "not confirmed" is the case the team
    // has to act on, and silence would read as an oversight.
    if (form.querySelector('[name="participant_consent_confirmed"]')) {
      lines.push('Participant consent confirmed: ' +
        (data.get('participant_consent_confirmed') ? 'Yes' : 'No — contact the referrer first'));
    }
    var subject = encodeURIComponent(subjectPrefix + ' — ' + (data.get('name') || 'Website enquiry'));
    var body = encodeURIComponent(lines.join('\n'));
    return 'mailto:' + ENQUIRY_EMAIL + '?subject=' + subject + '&body=' + body;
  }

  document.querySelectorAll('form[data-form-name]').forEach(function (form) {
    // Tracks whether this form has already produced a successful
    // conversion, synchronously, so a rapid double-click (or a second
    // submit fired while the first is still resolving) can never push a
    // second enquiry_submitted/referral_submitted event or send a second
    // mailto — one real enquiry must equal exactly one conversion.
    form.dataset.hwSubmitted = 'false';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.dataset.hwSubmitted === 'true') return;

      var status = form.querySelector('.form-status');
      var submitBtn = form.querySelector('.form-submit');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Set before any async/navigation work starts — this is the guard,
      // not submitBtn.disabled (which a mailto: "navigation" that never
      // actually unloads the page would leave re-enabled almost
      // instantly, reopening the double-submit window).
      form.dataset.hwSubmitted = 'true';
      if (submitBtn) submitBtn.disabled = true;

      var formName = form.getAttribute('data-form-name');
      var eventName = formName === 'referral' ? 'referral_submitted' : 'enquiry_submitted';

      var finish = function (delivered) {
        window.dataLayer.push({ event: eventName, form_name: formName, delivery_method: delivered });
        // GA4's recognised recommended-event name for a completed lead —
        // pushed alongside the specific event above (not instead of it)
        // so Google Ads' "import from GA4" conversion flow has a
        // standard event to find without any extra GTM configuration.
        window.dataLayer.push({ event: 'generate_lead', lead_type: formName });
        if (status) {
          status.textContent = delivered === 'server'
            ? "Thanks — your enquiry has been sent. We'll be in touch soon."
            : "Opening your email app to send this enquiry to our team — if nothing opens, please call 0433 604 507.";
          status.className = 'form-status ok';
        }
        if (submitBtn) submitBtn.textContent = 'Sent';
        // submitBtn stays disabled: this form has already converted once.
      };

      if (FORM_ENDPOINT) {
        var payload = formDataToJson(form);
        payload.form_name = formName;
        // Which page this form was actually on. Sent so the same partial can be
        // dropped onto any page — a service page, a location page — and the
        // enquiry is attributed to that page rather than to whichever page the
        // server happens to assume. The server sanitises and caps it, and uses
        // the request's own Referer for the URL.
        payload.page_title = document.title;
        fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (res) {
          if (res.ok) { form.reset(); finish('server'); }
          else { window.location.href = buildMailto(form, formName === 'referral' ? 'NDIS Referral' : 'NDIS Enquiry'); finish('mailto'); }
        }).catch(function () {
          window.location.href = buildMailto(form, formName === 'referral' ? 'NDIS Referral' : 'NDIS Enquiry');
          finish('mailto');
        });
      } else {
        window.location.href = buildMailto(form, formName === 'referral' ? 'NDIS Referral' : 'NDIS Enquiry');
        finish('mailto');
      }
    });
  });
})();
