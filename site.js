// LeadVerdict forms → /api/lead (Vercel function) → HubSpot contacts.
// audit-form, newsletter-form and case-form each send their fields plus a `type`.
(function () {
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var TYPES = { "audit-form": "audit", "newsletter-form": "newsletter", "case-form": "case" };
  var REQUIRED = {
    audit: { fields: ["name", "email", "websiteUrl"], msg: "Add your name, email and website, then send again." },
    newsletter: { fields: ["email"], msg: "Enter a valid email address." },
    "case": { fields: ["name", "email", "business"], msg: "Add your name, email and business name, then send again." }
  };

  function status(form, cls, html) {
    var s = form.querySelector(".form-status") || (form.parentNode && form.parentNode.querySelector(".form-status"));
    if (s) { s.className = "form-status " + cls; s.innerHTML = html; }
  }

  Object.keys(TYPES).forEach(function (id) {
    var form = document.getElementById(id);
    if (!form) return;
    var type = TYPES[id];

    // Honeypot: hidden from people, filled in by bots.
    var trap = document.createElement("input");
    trap.type = "text"; trap.name = "company_site"; trap.tabIndex = -1; trap.autocomplete = "off";
    trap.setAttribute("aria-hidden", "true");
    trap.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0";
    form.appendChild(trap);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var data = { type: type, page: location.pathname };
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name) data[el.name] = String(el.value || "").trim(); });
      var req = REQUIRED[type];
      if (req.fields.some(function (f) { return !data[f]; })) { status(form, "err", req.msg); return; }
      if (!EMAIL.test(data.email)) { status(form, "err", "That email address is missing something. Check it and send again."); return; }

      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      status(form, "", "Sending…");
      try {
        var res = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok || !out.ok) throw new Error(out.error || "failed");
        form.reset();
        status(form, "ok", out.message || "Sent.");
        try { window.gtag && window.gtag("event", "generate_lead", { event_category: type, event_label: location.pathname }); } catch (_) {}
        try { window.fbq && window.fbq("track", "Lead"); } catch (_) {}
      } catch (_) {
        status(form, "err", 'That didn\'t go through. Email <a href="mailto:leadverdict.co@gmail.com">leadverdict.co@gmail.com</a> instead.');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  });
})();
