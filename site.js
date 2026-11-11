// LeadVerdict forms → the same Convex backend the old React site used.
// audit-form → audit:captureAuditLead · newsletter-form → newsletter:subscribe · case-form → contact:submit
(function () {
  var CONVEX = "https://prestigious-kudu-872.convex.cloud/api/mutation";
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function val(form, name) { var el = form.elements[name]; return el ? String(el.value || "").trim() : ""; }
  function say(form, cls, html) { var s = form.querySelector(".form-status") || form.parentNode.querySelector(".form-status"); if (s) { s.className = "form-status " + cls; s.innerHTML = html; } }
  function fail(form) { say(form, "err", 'That didn\'t go through. Email <a href="mailto:leadverdict.co@gmail.com">leadverdict.co@gmail.com</a> instead.'); }
  function track(label) {
    try { window.gtag && window.gtag("event", "generate_lead", { event_category: label, event_label: location.pathname }); } catch (_) {}
    try { window.fbq && window.fbq("track", "Lead"); } catch (_) {}
  }
  async function call(path, args) {
    var res = await fetch(CONVEX, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: path, args: args, format: "json" }) });
    var out = await res.json();
    if (out.status !== "success") throw new Error(out.errorMessage || "rejected");
    return out.value;
  }
  function wire(id, build, path, done) {
    var form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var args = build(form);
      if (typeof args === "string") { say(form, "err", args); return; }
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      say(form, "", "Sending…");
      try { var v = await call(path, args); form.reset(); say(form, "ok", done(args, v)); track(id); }
      catch (_) { fail(form); }
      finally { if (btn) btn.disabled = false; }
    });
  }

  wire("audit-form", function (f) {
    var a = { name: val(f, "name"), email: val(f, "email"), websiteUrl: val(f, "websiteUrl") };
    if (!a.name || !a.email || !a.websiteUrl) return "Add your name, email and website, then send again.";
    if (!EMAIL.test(a.email)) return "That email address is missing something. Check it and send again.";
    if (val(f, "phone")) a.phone = val(f, "phone");
    return a;
  }, "audit:captureAuditLead", function (a) { return "Got it. Your audit goes to " + a.email + "."; });

  wire("newsletter-form", function (f) {
    var email = val(f, "email");
    if (!EMAIL.test(email)) return "Enter a valid email address.";
    return { email: email, source: "landing" };
  }, "newsletter:subscribe", function (a, v) { return (v && v.message) || "You're subscribed."; });

  wire("case-form", function (f) {
    var name = val(f, "name"), email = val(f, "email"), business = val(f, "business");
    if (!name || !email || !business) return "Add your name, email and business name, then send again.";
    if (!EMAIL.test(email)) return "That email address is missing something. Check it and send again.";
    var a = {
      name: name, email: email, subject: "Case review: " + business,
      message: ["Problem: " + (val(f, "problem") || "not given"), "Profile link: " + (val(f, "profile") || "not given"), "Details: " + (val(f, "details") || "none"), "Page: " + location.pathname].join("\n")
    };
    if (val(f, "phone")) a.phone = val(f, "phone");
    return a;
  }, "contact:submit", function (a) { return "Sent. The reply goes to " + a.email + "."; });
})();
