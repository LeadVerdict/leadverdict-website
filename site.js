// Case review form → the existing Convex backend (same `contact:submit` mutation the old site used).
(function () {
  var CONVEX = "https://prestigious-kudu-872.convex.cloud/api/mutation";
  var form = document.getElementById("case-form");
  if (!form) return;
  var status = form.querySelector(".form-status");
  var button = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var d = new FormData(form);
    var name = (d.get("name") || "").trim();
    var email = (d.get("email") || "").trim();
    var business = (d.get("business") || "").trim();
    if (!name || !email || !business) {
      status.className = "form-status err";
      status.textContent = "Add your name, email and business name, then send again.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.className = "form-status err";
      status.textContent = "That email address is missing something. Check it and send again.";
      return;
    }
    var message = [
      "Problem: " + (d.get("problem") || "not given"),
      "Profile link: " + ((d.get("profile") || "").trim() || "not given"),
      "Details: " + ((d.get("details") || "").trim() || "none"),
      "Page: " + location.pathname
    ].join("\n");

    button.disabled = true;
    status.className = "form-status";
    status.textContent = "Sending…";
    try {
      var res = await fetch(CONVEX, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "contact:submit",
          format: "json",
          args: Object.assign(
            { name: name, email: email, subject: "Case review: " + business, message: message },
            (d.get("phone") || "").trim() ? { phone: d.get("phone").trim() } : {}
          )
        })
      });
      var out = await res.json();
      if (out.status !== "success") throw new Error(out.errorMessage || "rejected");
      form.reset();
      status.className = "form-status ok";
      status.textContent = "Sent. The reply goes to " + email + ".";
      try { window.gtag && window.gtag("event", "generate_lead", { event_category: "case_review", event_label: location.pathname }); } catch (_) {}
      try { window.fbq && window.fbq("track", "Lead"); } catch (_) {}
    } catch (err) {
      status.className = "form-status err";
      status.innerHTML = 'The form didn\'t go through. Email <a href="mailto:leadverdict.co@gmail.com">leadverdict.co@gmail.com</a> instead.';
    } finally {
      button.disabled = false;
    }
  });
})();
