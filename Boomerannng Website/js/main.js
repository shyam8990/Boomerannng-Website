/* ==================================================================
 * Freshbrook — main.js
 * Vanilla JavaScript, no jQuery. One function per feature, each with
 * guard clauses so it is safe to load on every page.
 * ================================================================== */
(function () {
  "use strict";

  /* ----------------------------------------------------------------
   * PRICES — every number the quote card, calculator and booking
   * recap use. Edit here to change your pricing everywhere.
   *   base  : studio or 1 bedroom with 1 bathroom
   *   bed   : each bedroom after the first
   *   bath  : each bathroom after the first
   * ---------------------------------------------------------------- */
  var PRICES = {
    currency: "$",
    hourly: 45,            // cleaner-hour rate used to estimate time on site
    carpetMinimum: 90,     // minimum for a carpet & upholstery only visit
    services: {
      regular: { label: "Regular home clean", base: 89, bed: 22, bath: 18 },
      deep:    { label: "Deep clean", base: 159, bed: 38, bath: 30 },
      tenancy: { label: "End-of-tenancy clean", base: 199, bed: 45, bath: 35 },
      carpet:  { label: "Carpet & upholstery", base: 0, bed: 0, bath: 0 }
    },
    // "included" lists services where the extra is already part of the clean
    extras: {
      oven:     { label: "Inside the oven", price: 45, included: ["tenancy"] },
      fridge:   { label: "Inside the fridge", price: 30, included: ["tenancy"] },
      windows:  { label: "Interior windows", price: 40, included: ["deep", "tenancy"] },
      cabinets: { label: "Inside kitchen cabinets", price: 35, included: ["deep", "tenancy"] },
      laundry:  { label: "Laundry & ironing", price: 30, included: [] },
      balcony:  { label: "Balcony or patio", price: 25, included: [] }
    },
    counts: {
      carpet: { one: "carpet room", many: "carpet rooms", price: 35 },
      stairs: { one: "flight of stairs", many: "flights of stairs", price: 45 },
      seats:  { one: "upholstery seat", many: "upholstery seats", price: 22 }
    },
    // Frequency discounts apply to regular home cleans only
    frequency: {
      once:     { label: "One-off", unit: "for one visit", discount: 0 },
      monthly:  { label: "Monthly", unit: "per visit, monthly", discount: 0.10 },
      biweekly: { label: "Every 2 weeks", unit: "per visit, every 2 weeks", discount: 0.15 },
      weekly:   { label: "Weekly", unit: "per visit, weekly", discount: 0.20 }
    },
    newClientDeepDiscount: 0.15
  };

  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var params = new URLSearchParams(window.location.search);

  /* ----------------------------------------------------------------
   * Helpers
   * ---------------------------------------------------------------- */
  function money(n) { return PRICES.currency + Math.round(n).toLocaleString("en-US"); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function toInt(v, fallback) { var n = parseInt(v, 10); return isNaN(n) ? fallback : n; }

  function homeLabel(bed, bath) {
    return (bed === 0 ? "Studio" : bed + " bed") + ", " + bath + " bath";
  }

  /* Works out an estimate from a plain state object. Shared by the
     homepage quote card, the calculator and the booking recap. */
  function estimate(s) {
    var svc = PRICES.services[s.service] || PRICES.services.regular;
    var lines = [];
    if (s.service !== "carpet") {
      lines.push({ label: "Base price (studio or 1 bed, 1 bath)", value: svc.base });
      var xBed = Math.max(0, s.bed - 1);
      var xBath = Math.max(0, s.bath - 1);
      if (xBed) lines.push({ label: plural(xBed, "extra bedroom", "extra bedrooms"), value: xBed * svc.bed });
      if (xBath) lines.push({ label: plural(xBath, "extra bathroom", "extra bathrooms"), value: xBath * svc.bath });
      (s.extras || []).forEach(function (id) {
        var e = PRICES.extras[id];
        if (!e || e.included.indexOf(s.service) > -1) return;
        lines.push({ label: e.label, value: e.price });
      });
    }
    Object.keys(PRICES.counts).forEach(function (key) {
      var n = s[key] || 0;
      var c = PRICES.counts[key];
      if (n > 0) lines.push({ label: plural(n, c.one, c.many) + " × " + money(c.price), value: n * c.price });
    });
    var subtotal = lines.reduce(function (sum, l) { return sum + l.value; }, 0);
    if (s.service === "carpet" && subtotal < PRICES.carpetMinimum) {
      lines.push({ label: subtotal ? "Top-up to the $" + PRICES.carpetMinimum + " visit minimum" : "Minimum carpet visit", value: PRICES.carpetMinimum - subtotal });
      subtotal = PRICES.carpetMinimum;
    }
    var freq = PRICES.frequency[s.service === "regular" ? s.freq : "once"] || PRICES.frequency.once;
    var rate = freq.discount;
    var discountLabel = rate ? freq.label + " discount (" + Math.round(rate * 100) + "%)" : "";
    if (s.service === "deep" && s.newclient) {
      rate = PRICES.newClientDeepDiscount;
      discountLabel = "First deep clean (" + Math.round(rate * 100) + "% off)";
    }
    var discount = Math.round(subtotal * rate);
    var workHours = subtotal / PRICES.hourly;
    var team = workHours > 4 ? 2 : 1;
    var onSite = Math.max(1, Math.round((workHours / team) * 2) / 2);
    return {
      lines: lines, subtotal: subtotal, discount: discount, discountLabel: discountLabel,
      total: subtotal - discount, unit: freq.unit, team: team, hours: onSite, label: svc.label
    };
  }

  /* ----------------------------------------------------------------
   * Mobile navigation: close the collapse after a link is tapped
   * ---------------------------------------------------------------- */
  function initNav() {
    var collapse = document.getElementById("primary-nav");
    if (!collapse || !window.bootstrap) return;
    collapse.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (!collapse.classList.contains("show")) return;
        var inst = window.bootstrap.Collapse.getInstance(collapse);
        if (inst) inst.hide();
      });
    });
  }

  /* ----------------------------------------------------------------
   * Header shadow once the page scrolls
   * ---------------------------------------------------------------- */
  function initStickyHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ----------------------------------------------------------------
   * Reveal on scroll (content is visible without JS; see .js .reveal)
   * ---------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------
   * Count-up stats
   * ---------------------------------------------------------------- */
  function initCounters() {
    var nums = document.querySelectorAll("[data-count]");
    if (!nums.length || prefersReduced || !("IntersectionObserver" in window)) return;
    var run = function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var decimals = toInt(el.getAttribute("data-decimals"), 0);
      var suffix = el.getAttribute("data-suffix") || "";
      var start = null;
      var step = function (ts) {
        if (!start) start = ts;
        var p = Math.min(1, (ts - start) / 1400);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
        if (p < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------
   * Accessible tabs (WAI-ARIA tabs pattern, automatic activation)
   * ---------------------------------------------------------------- */
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (wrap) {
      var tabs = Array.prototype.slice.call(wrap.querySelectorAll('[role="tab"]'));
      if (!tabs.length) return;
      var select = function (tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute("aria-controls"));
          if (panel) panel.hidden = !on;
        });
        if (focus) tab.focus();
      };
      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () { select(tab, false); });
        tab.addEventListener("keydown", function (e) {
          var next = null;
          if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
          else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
          else if (e.key === "Home") next = tabs[0];
          else if (e.key === "End") next = tabs[tabs.length - 1];
          if (!next) return;
          e.preventDefault();
          select(next, true);
        });
      });
      select(tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0], false);
    });
  }

  /* ----------------------------------------------------------------
   * Homepage instant quote card
   * ---------------------------------------------------------------- */
  function initQuickQuote() {
    var form = document.querySelector("[data-quick-quote]");
    if (!form) return;
    var out = document.getElementById("qq-total");
    var unit = document.getElementById("qq-unit");
    var bed = form.elements.bed;
    var bath = form.elements.bath;
    var update = function () {
      var service = form.elements.service.value;
      var isCarpet = service === "carpet";
      bed.disabled = isCarpet;
      bath.disabled = isCarpet;
      var r = estimate({ service: service, bed: toInt(bed.value, 1), bath: toInt(bath.value, 1), freq: "once" });
      if (out) out.textContent = money(r.total);
      if (unit) unit.textContent = isCarpet ? "minimum visit, add rooms next" : "per visit, before extras";
    };
    form.addEventListener("change", update);
    update();
  }

  /* ----------------------------------------------------------------
   * Pricing page quote calculator
   * ---------------------------------------------------------------- */
  function initSteppers(scope) {
    scope.querySelectorAll(".stepper").forEach(function (box) {
      var input = box.querySelector("input");
      if (!input) return;
      var min = toInt(input.min, 0);
      var max = toInt(input.max, 99);
      var buttons = box.querySelectorAll("[data-step]");
      var sync = function () {
        buttons.forEach(function (b) {
          var d = toInt(b.getAttribute("data-step"), 0);
          var v = toInt(input.value, min);
          b.disabled = input.disabled || (d < 0 ? v <= min : v >= max);
        });
      };
      buttons.forEach(function (b) {
        b.addEventListener("click", function () {
          input.value = clamp(toInt(input.value, min) + toInt(b.getAttribute("data-step"), 0), min, max);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      });
      input.addEventListener("input", sync);
      input.addEventListener("change", function () {
        input.value = clamp(toInt(input.value, min), min, max);
        sync();
      });
      box.addEventListener("freshbrook:sync", sync);
      sync();
    });
  }

  function initCalculator() {
    var form = document.querySelector("[data-calc]");
    if (!form) return;
    var el = function (sel) { return form.querySelector(sel); };
    var homeSet = el("[data-home-size]");
    var carpetNote = el("[data-carpet-note]");
    var freqNote = el("[data-freq-note]");
    var lines = el("[data-sum-lines]");
    var totalOut = el("[data-sum-total]");

    // Apply values passed from the homepage quote card or a service link
    var setRadio = function (name, value) {
      var r = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
      if (r) r.checked = true;
    };
    if (params.get("service")) setRadio("service", params.get("service"));
    if (params.get("freq")) setRadio("freq", params.get("freq"));
    ["bed", "bath", "carpet", "stairs", "seats"].forEach(function (key) {
      var input = form.elements[key];
      if (input && params.get(key) !== null) input.value = clamp(toInt(params.get(key), toInt(input.value, 0)), toInt(input.min, 0), toInt(input.max, 99));
    });
    params.getAll("extras").forEach(function (v) {
      var cb = form.querySelector('input[name="extras"][value="' + v + '"]');
      if (cb) cb.checked = true;
    });
    if (params.get("newclient")) form.elements.newclient.checked = true;

    initSteppers(form);

    var read = function () {
      var extras = [];
      form.querySelectorAll('input[name="extras"]:checked').forEach(function (cb) { extras.push(cb.value); });
      var checked = function (name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ""; };
      return {
        service: checked("service") || "regular",
        bed: toInt(form.elements.bed.value, 1),
        bath: toInt(form.elements.bath.value, 1),
        extras: extras,
        carpet: toInt(form.elements.carpet.value, 0),
        stairs: toInt(form.elements.stairs.value, 0),
        seats: toInt(form.elements.seats.value, 0),
        freq: checked("freq") || "once",
        newclient: form.elements.newclient.checked
      };
    };

    var update = function () {
      var s = read();
      var isCarpet = s.service === "carpet";

      // Home size is irrelevant for carpet-only visits
      if (homeSet) {
        homeSet.disabled = isCarpet;
        homeSet.querySelectorAll(".stepper").forEach(function (b) { b.dispatchEvent(new Event("freshbrook:sync")); });
      }
      if (carpetNote) carpetNote.hidden = !isCarpet;

      // Extras: unavailable for carpet-only, marked "Included" where the service covers them
      form.querySelectorAll('input[name="extras"]').forEach(function (cb) {
        var e = PRICES.extras[cb.value];
        var tag = cb.parentNode.querySelector("[data-price-tag]");
        var included = e && e.included.indexOf(s.service) > -1;
        cb.disabled = isCarpet || included;
        if (tag) tag.textContent = included ? "Included" : "+" + money(e ? e.price : 0);
      });

      // Frequency: regular cleans only
      form.querySelectorAll('input[name="freq"]').forEach(function (r) {
        r.disabled = s.service !== "regular" && r.value !== "once";
        if (r.disabled && r.checked) setRadio("freq", "once");
      });
      if (freqNote) {
        freqNote.textContent = s.service === "regular"
          ? "Regular home cleans get cheaper the more often we visit."
          : "Frequency discounts apply to regular home cleans. This service is booked as a one-off.";
      }
      s = read();

      var r = estimate(s);
      if (lines) {
        lines.innerHTML = "";
        r.lines.forEach(function (l) {
          var li = document.createElement("li");
          li.innerHTML = "<span></span><span></span>";
          li.children[0].textContent = l.label;
          li.children[1].textContent = money(l.value);
          lines.appendChild(li);
        });
        if (r.discount) {
          var li = document.createElement("li");
          li.className = "discount";
          li.innerHTML = "<span></span><span></span>";
          li.children[0].textContent = r.discountLabel;
          li.children[1].textContent = "−" + money(r.discount);
          lines.appendChild(li);
        }
      }
      var svcText = isCarpet ? "Carpets, stairs and upholstery" : r.label + " · " + homeLabel(s.bed, s.bath);
      el("[data-sum-service]").textContent = svcText;
      totalOut.textContent = money(r.total);
      el("[data-sum-unit]").textContent = r.unit;
      el("[data-sum-team]").textContent = isCarpet ? "1 technician" : plural(r.team, "cleaner", "cleaners");
      el("[data-sum-hours]").textContent = "about " + plural(r.hours, "hour", "hours") + " on site";
      el("[data-sum-input]").value = r.total;
    };

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
    initCalcBar(form);
  }

  /* Small screens: a fixed bar keeps the total visible while the
     calculator scrolls, and hides once the full summary is on screen */
  function initCalcBar(form) {
    var bar = document.querySelector("[data-calc-bar]");
    var main = form.querySelector(".calc-main");
    var summary = form.querySelector(".summary");
    var out = bar && bar.querySelector("[data-calc-bar-total]");
    var total = form.querySelector("[data-sum-total]");
    if (!bar || !main || !summary || !out || !total) return;
    var sync = function () { out.textContent = total.textContent; };
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    sync();
    if (!("IntersectionObserver" in window)) return;
    var mainIn = false, sumIn = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.target === main) mainIn = e.isIntersecting;
        if (e.target === summary) sumIn = e.isIntersecting;
      });
      bar.classList.toggle("is-hidden", !mainIn || sumIn);
    }, { threshold: 0 });
    io.observe(main);
    io.observe(summary);
  }

  /* ----------------------------------------------------------------
   * Shared validation for front-end-only forms
   * ---------------------------------------------------------------- */
  function fieldWrap(input) {
    return input.closest(".field") || null;
  }

  function markField(input, ok) {
    var wrap = fieldWrap(input);
    if (input.type === "radio" || input.type === "checkbox") {
      if (wrap) wrap.classList.toggle("invalid", !ok);
    } else {
      input.classList.toggle("is-invalid", !ok);
    }
    if (ok) input.removeAttribute("aria-invalid");
    else input.setAttribute("aria-invalid", "true");
  }

  /* Returns a list of {input, message} for every invalid field.
     `extra` can add custom checks: function(input) -> message|"" */
  function validateForm(form, extra) {
    var problems = [];
    var seenRadio = {};
    form.querySelectorAll("input, select, textarea").forEach(function (input) {
      if (input.disabled || input.type === "hidden" || input.closest("[hidden]")) return;
      if (input.type === "radio") {
        if (seenRadio[input.name]) return;
        seenRadio[input.name] = true;
        var group = form.querySelectorAll('input[name="' + input.name + '"]');
        var required = Array.prototype.some.call(group, function (r) { return r.required; });
        var picked = form.querySelector('input[name="' + input.name + '"]:checked');
        var ok = !required || !!picked;
        group.forEach(function (r) { markField(r, ok); });
        if (!ok) problems.push({ input: group[0] });
        return;
      }
      var msg = "";
      if (!input.checkValidity()) msg = "invalid";
      if (!msg && extra) msg = extra(input) || "";
      markField(input, !msg);
      if (msg) problems.push({ input: input });
    });
    return problems;
  }

  function errorText(input) {
    var ids = (input.getAttribute("aria-describedby") || "").split(/\s+/);
    var wrap = input.closest("[aria-describedby]");
    if (wrap && wrap !== input) ids = ids.concat(wrap.getAttribute("aria-describedby").split(/\s+/));
    for (var i = 0; i < ids.length; i++) {
      var node = ids[i] && document.getElementById(ids[i]);
      if (node && node.classList.contains("field-error")) return node.textContent;
    }
    return "Please check this field.";
  }

  function liveRevalidate(form, extra) {
    form.addEventListener("input", function (e) {
      var t = e.target;
      if (t.getAttribute("aria-invalid") !== "true" || t.type === "radio") return;
      var ok = t.checkValidity() && !(extra && extra(t));
      markField(t, ok);
    });
    form.addEventListener("change", function (e) {
      var t = e.target;
      if (t.type === "radio" || t.type === "checkbox") {
        var wrap = fieldWrap(t);
        if (wrap && wrap.classList.contains("invalid")) {
          var ok = t.type === "radio" ? true : t.checked || !t.required;
          markField(t, ok);
          if (t.type === "radio") form.querySelectorAll('input[name="' + t.name + '"]').forEach(function (r) { markField(r, true); });
        }
      }
    });
  }

  /* Generic forms (contact): validate, then show the success panel */
  function initForms() {
    document.querySelectorAll("form[data-validate]").forEach(function (form) {
      liveRevalidate(form);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var problems = validateForm(form);
        if (problems.length) { problems[0].input.focus(); return; }
        var success = form.querySelector(".form-success");
        var fields = form.querySelector(".form-fields");
        var nameInput = form.elements.name;
        var nameSlot = form.querySelector("[data-success-name]");
        if (nameSlot && nameInput && nameInput.value.trim()) nameSlot.textContent = nameInput.value.trim().split(/\s+/)[0] + ", we’ve got it";
        if (fields) fields.hidden = true;
        if (success) { success.classList.add("show"); success.focus(); }
      });
    });
  }

  /* Contact page: preselect topic from ?topic= and show office fields */
  function initContactTopic() {
    var topic = document.getElementById("ct-topic");
    if (!topic) return;
    var office = document.querySelector("[data-office-fields]");
    var wanted = params.get("topic");
    if (wanted && topic.querySelector('option[value="' + wanted + '"]')) topic.value = wanted;
    var sync = function () { if (office) office.hidden = topic.value !== "office"; };
    topic.addEventListener("change", sync);
    sync();
  }

  /* ----------------------------------------------------------------
   * Booking page
   * ---------------------------------------------------------------- */
  function isoDate(d) {
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function parseISO(v) {
    var p = (v || "").split("-");
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  function longDate(d) {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  function initBooking() {
    var form = document.querySelector("[data-booking]");
    if (!form) return;
    var summary = document.querySelector("[data-error-summary]");
    var list = document.querySelector("[data-error-list]");
    var confirm = document.querySelector("[data-confirm]");
    var recap = document.querySelector("[data-quote-recap]");
    var dateInput = form.elements.date;
    var slots = form.querySelectorAll('input[name="slot"]');
    var slotStatus = document.getElementById("b-slot-status");
    var accessNotes = form.elements.access_notes;
    var accessOptional = form.querySelector("[data-access-optional]");
    var petNotes = form.querySelector("[data-pet-notes]");

    // Prefill from the calculator
    ["service", "freq", "bed", "bath"].forEach(function (key) {
      var v = params.get(key);
      var sel = form.elements[key];
      if (v !== null && sel && sel.querySelector('option[value="' + v + '"]')) sel.value = v;
    });

    if (recap && params.get("estimate")) {
      var s = {
        service: params.get("service") || "regular",
        bed: toInt(params.get("bed"), 1), bath: toInt(params.get("bath"), 1),
        extras: params.getAll("extras"),
        carpet: toInt(params.get("carpet"), 0), stairs: toInt(params.get("stairs"), 0), seats: toInt(params.get("seats"), 0),
        freq: params.get("freq") || "once", newclient: !!params.get("newclient")
      };
      var r = estimate(s);
      var parts = [];
      s.extras.forEach(function (id) { if (PRICES.extras[id] && PRICES.extras[id].included.indexOf(s.service) < 0) parts.push(PRICES.extras[id].label.toLowerCase()); });
      Object.keys(PRICES.counts).forEach(function (k) { if (s[k]) parts.push(plural(s[k], PRICES.counts[k].one, PRICES.counts[k].many)); });
      var text = recap.querySelector("[data-quote-recap-text]");
      var what = s.service === "carpet" ? r.label : r.label + ", " + homeLabel(s.bed, s.bath).toLowerCase();
      text.innerHTML = "<strong></strong> <span></span>";
      text.children[0].textContent = "Your quote: " + money(r.total) + " " + r.unit + ".";
      text.children[1].textContent = what + (parts.length ? ", plus " + parts.join(", ") : "") + ". Estimated, confirmed before your clean.";
      recap.hidden = false;
      form.dataset.estimate = money(r.total) + " " + r.unit;
    }

    // Dates: tomorrow onwards, up to 8 weeks out, no Sundays
    var tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
    var last = new Date(tomorrow); last.setDate(last.getDate() + 56);
    if (dateInput) { dateInput.min = isoDate(tomorrow); dateInput.max = isoDate(last); }

    var dateProblem = function (input) {
      if (input !== dateInput) return "";
      var d = parseISO(dateInput.value);
      if (!d || d < tomorrow || d > last || d.getDay() === 0) return "bad-date";
      return "";
    };

    // Demo availability: a few windows are already taken on each day,
    // worked out from the date so the same day always looks the same.
    var updateSlots = function () {
      var d = parseISO(dateInput.value);
      if (!d || dateProblem(dateInput)) {
        slots.forEach(function (r) { r.disabled = false; });
        if (slotStatus) slotStatus.textContent = d && d.getDay() === 0 ? "We don’t clean on Sundays. Please pick Monday to Saturday." : "Pick a date to see which windows are free.";
        return;
      }
      var seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
      var free = 0;
      var taken = Array.prototype.map.call(slots, function (r, i) { return ((seed * (i + 3)) % 7) < 2; });
      if (d.getDay() === 6) taken[slots.length - 1] = true; // Saturdays finish early
      if (taken.filter(function (t) { return !t; }).length < 2) { taken[1] = false; taken[2] = false; }
      slots.forEach(function (r, i) {
        r.disabled = taken[i];
        if (taken[i] && r.checked) r.checked = false;
        r.nextElementSibling.querySelector("small").textContent = taken[i] ? "Booked" : ["Early", "Morning", "Midday", "Afternoon", "Late"][i];
        if (!taken[i]) free++;
      });
      if (slotStatus) slotStatus.textContent = free + " of " + slots.length + " arrival windows free on " + longDate(d) + ".";
    };
    if (dateInput) dateInput.addEventListener("change", updateSlots);

    // Access notes become required when nobody will be home
    var syncAccess = function () {
      var picked = form.querySelector('input[name="access"]:checked');
      var needed = picked && picked.value !== "home";
      if (!accessNotes) return;
      accessNotes.required = !!needed;
      if (accessOptional) accessOptional.textContent = needed ? "(required)" : "(optional)";
      if (!needed) markField(accessNotes, true);
    };
    var syncPets = function () {
      var picked = form.querySelector('input[name="pets"]:checked');
      if (petNotes) petNotes.hidden = !picked || picked.value === "none";
    };
    form.addEventListener("change", function (e) {
      if (e.target.name === "access") syncAccess();
      if (e.target.name === "pets") syncPets();
    });
    syncAccess();
    syncPets();
    liveRevalidate(form, dateProblem);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var problems = validateForm(form, dateProblem);
      if (problems.length) {
        list.innerHTML = "";
        problems.forEach(function (p) {
          var li = document.createElement("li");
          var a = document.createElement("a");
          a.href = "#" + p.input.id;
          a.textContent = errorText(p.input);
          a.addEventListener("click", function (ev) { ev.preventDefault(); p.input.focus(); });
          li.appendChild(a);
          list.appendChild(li);
        });
        summary.classList.add("show");
        summary.focus();
        return;
      }
      summary.classList.remove("show");

      // Build the confirmation
      var val = function (name) { var f = form.elements[name]; return f ? (f.value || "").trim() : ""; };
      var opt = function (name) { var s = form.elements[name]; return s && s.options ? s.options[s.selectedIndex].text : ""; };
      var checkedLabel = function (name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.nextElementSibling.textContent.trim() : ""; };
      var first = val("name").split(/\s+/)[0];
      var d = parseISO(val("date"));
      var rows = [
        ["Service", opt("service") + (val("service") === "carpet" ? "" : " · " + homeLabel(toInt(val("bed"), 1), toInt(val("bath"), 1))) + " · " + opt("freq")],
        ["When", (d ? longDate(d) : val("date")) + ", arriving " + checkedLabel("slot").replace(/(Early|Morning|Midday|Afternoon|Late)$/, "").trim()],
        ["Address", [val("street"), val("unit"), val("city"), val("postcode")].filter(Boolean).join(", ")],
        ["Getting in", checkedLabel("access") + (val("access_notes") ? " — " + val("access_notes") : "")],
        ["Pets", checkedLabel("pets") + (val("pet_notes") && checkedLabel("pets") !== "No pets" ? " — " + val("pet_notes") : "")]
      ];
      if (form.dataset.estimate) rows.push(["Estimate", form.dataset.estimate]);
      var dl = confirm.querySelector("[data-confirm-list]");
      dl.innerHTML = "";
      rows.forEach(function (row) {
        var dt = document.createElement("dt"); dt.textContent = row[0];
        var dd = document.createElement("dd"); dd.textContent = row[1];
        dl.appendChild(dt); dl.appendChild(dd);
      });
      confirm.querySelector("[data-confirm-title]").textContent = "Thanks, " + first + ". Your booking request is in.";
      confirm.querySelector("[data-confirm-ref]").textContent = "FB-" + String(Math.floor(10000 + Math.random() * 89999));
      form.hidden = true;
      if (recap) recap.hidden = true;
      confirm.classList.add("show");
      confirm.focus();
      confirm.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    });

    var again = confirm && confirm.querySelector("[data-book-again]");
    if (again) {
      again.addEventListener("click", function () {
        form.reset();
        form.hidden = false;
        confirm.classList.remove("show");
        syncAccess(); syncPets(); updateSlots();
        form.querySelector("select, input").focus();
      });
    }
  }

  /* ----------------------------------------------------------------
   * Before / after comparison slider (native range input underneath,
   * so arrow keys, Home/End and Page keys work out of the box)
   * ---------------------------------------------------------------- */
  function initCompare() {
    document.querySelectorAll("[data-compare]").forEach(function (box) {
      var range = box.querySelector(".compare-range");
      if (!range) return;
      var set = function (v) {
        v = clamp(Math.round(v), 0, 100);
        range.value = v;
        box.style.setProperty("--pos", v + "%");
        range.setAttribute("aria-valuetext", v + "% before, " + (100 - v) + "% after");
      };
      range.addEventListener("input", function () { set(+range.value); });

      // Pointer dragging maps the exact pointer position to the split
      var dragging = false;
      var fromX = function (x) {
        var rect = box.getBoundingClientRect();
        set(((x - rect.left) / rect.width) * 100);
      };
      range.addEventListener("keydown", function () { box.removeAttribute("data-pointer"); });
      range.addEventListener("pointerdown", function (e) {
        dragging = true;
        box.setAttribute("data-pointer", "");
        if (range.setPointerCapture) range.setPointerCapture(e.pointerId);
        e.preventDefault();
        range.focus({ preventScroll: true });
        fromX(e.clientX);
      });
      range.addEventListener("pointermove", function (e) { if (dragging) fromX(e.clientX); });
      ["pointerup", "pointercancel"].forEach(function (t) { range.addEventListener(t, function () { dragging = false; }); });
      set(+range.value);

      // Example switcher (rug / sofa)
      var card = box.closest(".compare-card");
      var buttons = card ? card.querySelectorAll("[data-compare-src]") : [];
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          buttons.forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
          var src = btn.getAttribute("data-compare-src");
          box.querySelectorAll("img").forEach(function (img) { img.src = src; });
          box.querySelector(".compare-after").alt = btn.getAttribute("data-compare-alt");
          set(50);
        });
      });
    });
  }

  /* ---------------------------------------------------------------- */
  function init() {
    initNav();
    initStickyHeader();
    initReveal();
    initCounters();
    initTabs();
    initQuickQuote();
    initCalculator();
    initForms();
    initContactTopic();
    initBooking();
    initCompare();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
