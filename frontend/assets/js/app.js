const API_BASE = "https://sgamagework-production.up.railway.app/api";

// -----------------------------
// Customer Auth (JWT)
// -----------------------------
const CUSTOMER_TOKEN_KEY = "sgc_customer_token_v1";
const CUSTOMER_PROFILE_KEY = "sgc_customer_profile_v1";

function isInCustomerFolder() {
  // Works for both local file paths and hosted paths
  return String(location.pathname || "").includes("/customer/") || String(location.href || "").includes("/customer/");
}

function customerPaths() {
  if (isInCustomerFolder()) {
    return {
      login: "login.html",
      register: "register.html",
      dashboard: "dashboard.html"
    };
  }
  return {
    login: "customer/login.html",
    register: "customer/register.html",
    dashboard: "customer/dashboard.html"
  };
}

function getCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
}

function isCustomerLoggedIn() {
  return Boolean(getCustomerToken());
}

function getCustomerProfile() {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCustomerSession(token, customer) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, String(token || ""));
  if (customer) localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customer));
}

function clearCustomerSession() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_PROFILE_KEY);
  // Optional: clear cart on logout to avoid confusion
  try {
    localStorage.removeItem("sgc_cart_v1");
  } catch {}
}

function customerAuthHeader() {
  const t = getCustomerToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJSONCustomer(url, opts = {}) {
  const headers = {
    ...(opts.headers || {}),
    ...customerAuthHeader()
  };

  const res = await fetch(url, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    // Token invalid/expired
    clearCustomerSession();
  }
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function fetchCustomerMe() {
  if (!isCustomerLoggedIn()) return null;
  try {
    const me = await fetchJSONCustomer(`${API_BASE}/customers/me`);
    if (me?.customer) {
      localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(me.customer));
      return me.customer;
    }
    return null;
  } catch {
    return null;
  }
}

async function uploadReturnEvidence(files = []) {
  const list = Array.from(files || []).filter(Boolean).slice(0, 4);
  if (!list.length) return [];

  const formData = new FormData();
  list.forEach((file) => formData.append("evidence", file));

  const res = await fetch(`${API_BASE}/uploads/return-evidence`, {
    method: "POST",
    headers: {
      ...customerAuthHeader()
    },
    body: formData
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    clearCustomerSession();
  }
  if (!res.ok) throw new Error(data.message || "Failed to upload return evidence");
  return Array.isArray(data.files) ? data.files.map((item) => item.url).filter(Boolean) : [];
}

async function uploadPaymentProof(files = []) {
  const list = Array.from(files || []).filter(Boolean).slice(0, 5);
  if (!list.length) return [];

  const formData = new FormData();
  list.forEach((file) => formData.append("proof", file));

  const res = await fetch(`${API_BASE}/uploads/payment-proof`, {
    method: "POST",
    headers: {
      ...customerAuthHeader()
    },
    body: formData
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    clearCustomerSession();
  }
  if (!res.ok) throw new Error(data.message || "Failed to upload payment proof");
  return Array.isArray(data.files) ? data.files.map((item) => item.url).filter(Boolean) : [];
}

function requireCustomerLogin(message = "Please login to continue") {
  if (isCustomerLoggedIn()) return true;
  toast(message);
  const paths = customerPaths();
  const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
  location.href = `${paths.login}?next=${next}`;
  return false;
}

function initCustomerNav() {
  const authLink = document.getElementById("customerAuthLink");
  const logoutLink = document.getElementById("customerLogoutLink");
  if (!authLink && !logoutLink) return;

  const paths = customerPaths();
  const logged = isCustomerLoggedIn();

  if (authLink) {
    authLink.textContent = logged ? "My Account" : "Customer Login";
    authLink.href = logged ? paths.dashboard : paths.login;
  }

  if (logoutLink) {
    logoutLink.style.display = logged ? "inline-flex" : "none";
    logoutLink.onclick = (e) => {
      e.preventDefault();
      clearCustomerSession();
      toast("Logged out");
      const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
      location.href = `${paths.login}?next=${next}`;
    };
  }
}

// Auto-update nav on every page
document.addEventListener("DOMContentLoaded", () => {
  initCustomerNav();
});

let __siteSettingsPromise = null;

async function getSiteSettings(force = false) {
  if (!__siteSettingsPromise || force) {
    __siteSettingsPromise = fetchJSON(`${API_BASE}/settings`)
      .then((data) => {
        window.__sgcSettings = data || {};
        return window.__sgcSettings;
      })
      .catch(() => {
        window.__sgcSettings = window.__sgcSettings || {};
        return window.__sgcSettings;
      });
  }
  return __siteSettingsPromise;
}

async function loadSettings() {
  try {
    const s = await getSiteSettings();

    const bind = (key, value) => {
      document.querySelectorAll(`[data-setting="${key}"]`).forEach((el) => {
        el.textContent = value || el.textContent;
      });
    };

    bind("siteName", s.siteName);
    bind("tagline", s.tagline);
    bind("email", s.email);
    bind("phone", s.phone);
    bind("heroTitle", s.heroTitle);
    bind("heroSubtitle", s.heroSubtitle);
    const elSite = document.getElementById("siteName");
    if (elSite) elSite.textContent = s.siteName || elSite.textContent;

    const elTag = document.getElementById("siteTagline");
    if (elTag) elTag.textContent = s.tagline || elTag.textContent;

    const elEmail = document.getElementById("contactEmail");
    if (elEmail) elEmail.textContent = s.email || elEmail.textContent;

    const elPhone = document.getElementById("contactPhone");
    if (elPhone) elPhone.textContent = s.phone || elPhone.textContent;

    const heroTitle = document.getElementById("heroTitle");
    if (heroTitle) heroTitle.textContent = s.heroTitle || heroTitle.textContent;

    const heroSub = document.getElementById("heroSubtitle");
    if (heroSub) heroSub.textContent = s.heroSubtitle || heroSub.textContent;

    renderPublicDeliveryProcess().catch(() => {});
  } catch {
    // ignore settings load failures
  }
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


function normalizeWhatsAppNumber(raw = "") {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 10) return `94${digits.slice(1)}`;
  return digits;
}

function normalizePhoneForCall(raw = "") {
  const value = String(raw || "").trim();
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (value.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+94${digits.slice(1)}`;
  if (digits.startsWith("94")) return `+${digits}`;
  if (digits.length >= 9) return `+${digits}`;
  return digits;
}

function isProbablyMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile|webOS|Windows Phone/i.test(navigator.userAgent || "");
}

function getServiceContactChannels(settings = {}) {
  const phoneRaw = settings?.phone || document.getElementById("contactPhone")?.textContent || "";
  const emailRaw = settings?.email || document.getElementById("contactEmail")?.textContent || "";
  const whatsappRaw = settings?.whatsapp || phoneRaw;

  return {
    phone: String(phoneRaw || "").trim(),
    telHref: normalizePhoneForCall(phoneRaw || whatsappRaw) ? `tel:${normalizePhoneForCall(phoneRaw || whatsappRaw)}` : "",
    whatsappNumber: normalizeWhatsAppNumber(whatsappRaw),
    email: String(emailRaw || "").trim()
  };
}

function buildServiceLeadMessage(service = {}, mode = "general") {
  const serviceName = String(service?.name || "this service").trim();
  const category = String(service?.category || "").trim();
  const label = category ? `${serviceName} (${category})` : serviceName;

  if (mode === "wa-call") {
    return `Hi S.Gamage Constructions, I need a quick WhatsApp voice call / callback about ${label}. Please contact me when you are available.`;
  }

  if (mode === "email") {
    return `Hello S.Gamage Constructions,\n\nI need more information about ${label}. Please share pricing, timeline, and availability.\n\nThank you.`;
  }

  return `Hi S.Gamage Constructions, I am interested in ${label}. Please share more details / a quotation.`;
}

function buildWhatsAppUrls(number, message) {
  if (!number) return { app: "", web: "" };
  const encoded = encodeURIComponent(message || "");
  return {
    app: `whatsapp://send?phone=${number}&text=${encoded}`,
    web: `https://wa.me/${number}?text=${encoded}`
  };
}

function buildServiceEmailUrl(email, service) {
  if (!email) return "";
  const serviceName = String(service?.name || "Service Inquiry").trim();
  const subject = encodeURIComponent(`Service Inquiry - ${serviceName}`);
  const body = encodeURIComponent(buildServiceLeadMessage(service, "email"));
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function openWhatsAppIntent(appUrl, webUrl) {
  const fallbackUrl = webUrl || appUrl;
  if (!fallbackUrl) return;

  if (!isProbablyMobileDevice() || !appUrl) {
    window.open(fallbackUrl, "_blank", "noopener");
    return;
  }

  const timer = window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.open(fallbackUrl, "_blank", "noopener");
    }
  }, 900);

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };

  document.addEventListener("visibilitychange", onVisibility);

  try {
    window.location.href = appUrl;
  } catch {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.open(fallbackUrl, "_blank", "noopener");
  }
}

function closeServiceContactModal() {
  const modal = document.getElementById("serviceContactModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function ensureServiceContactModal() {
  const modal = document.getElementById("serviceContactModal");
  if (!modal || modal.dataset.bound === "1") return modal;

  modal.dataset.bound = "1";
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close-modal]")) {
      closeServiceContactModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeServiceContactModal();
    }
  });

  return modal;
}

function renderServiceContactOptions(service = {}, settings = {}) {
  const modal = ensureServiceContactModal();
  if (!modal) return;

  const wrap = modal.querySelector("[data-service-contact-options]");
  const meta = modal.querySelector("[data-service-contact-meta]");
  const channels = getServiceContactChannels(settings);
  const options = [];

  if (channels.telHref) {
    options.push({
      type: "link",
      title: "Normal Voice",
      tag: "Direct",
      icon: "📞",
      href: channels.telHref,
      target: "_self",
      copy: channels.phone ? `Call ${channels.phone} directly for this service.` : "Call the team directly for this service."
    });
  }

  if (channels.whatsappNumber) {
    const waCall = buildWhatsAppUrls(channels.whatsappNumber, buildServiceLeadMessage(service, "wa-call"));
    const waMsg = buildWhatsAppUrls(channels.whatsappNumber, buildServiceLeadMessage(service, "wa-msg"));

    options.push({
      type: "whatsapp-call",
      title: "WhatsApp Call",
      tag: "WhatsApp",
      icon: "🟢",
      appUrl: waCall.app,
      webUrl: waCall.web,
      copy: "Opens WhatsApp with a ready-made callback request, so you can continue by chat or voice inside WhatsApp."
    });

    options.push({
      type: "link",
      title: "WhatsApp Msg",
      tag: "Fast",
      icon: "💬",
      href: waMsg.web,
      target: "_blank",
      rel: "noopener noreferrer",
      copy: "Start a WhatsApp chat with a pre-filled service inquiry message."
    });
  }

  if (channels.email) {
    options.push({
      type: "link",
      title: "Email Inquiry",
      tag: "Formal",
      icon: "✉️",
      href: buildServiceEmailUrl(channels.email, service),
      target: "_self",
      copy: `Open your email app with ${String(service?.name || "the service").trim()} already filled in.`
    });
  }

  wrap.innerHTML = options.length
    ? options.map((option) => {
        const title = escapeHTML(option.title || "Contact");
        const tag = escapeHTML(option.tag || "Option");
        const copy = escapeHTML(option.copy || "");
        const icon = escapeHTML(option.icon || "•");

        if (option.type === "whatsapp-call") {
          return `
            <button type="button" class="contact-option-btn" data-whatsapp-call-app="${escapeHTML(option.appUrl || "")}" data-whatsapp-call-web="${escapeHTML(option.webUrl || "")}">
              <span class="contact-option-icon">${icon}</span>
              <span class="contact-option-content">
                <span class="contact-option-top">
                  <span class="contact-option-title">${title}</span>
                  <span class="contact-option-tag">${tag}</span>
                </span>
                <span class="contact-option-copy">${copy}</span>
              </span>
              <span class="contact-option-arrow">↗</span>
            </button>
          `;
        }

        const target = option.target ? ` target="${escapeHTML(option.target)}"` : "";
        const rel = option.rel ? ` rel="${escapeHTML(option.rel)}"` : "";
        return `
          <a class="contact-option-btn" href="${escapeHTML(option.href || "#")}"${target}${rel}>
            <span class="contact-option-icon">${icon}</span>
            <span class="contact-option-content">
              <span class="contact-option-top">
                <span class="contact-option-title">${title}</span>
                <span class="contact-option-tag">${tag}</span>
              </span>
              <span class="contact-option-copy">${copy}</span>
            </span>
            <span class="contact-option-arrow">↗</span>
          </a>
        `;
      }).join("")
    : `<div class="contact-empty-state">No direct contact channels are configured yet. Please update Phone / WhatsApp / Email in Admin → Site Settings.</div>`;

  wrap.querySelectorAll("[data-whatsapp-call-web]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openWhatsAppIntent(btn.getAttribute("data-whatsapp-call-app"), btn.getAttribute("data-whatsapp-call-web"));
    });
  });

  const metaBits = [];
  if (service?.category) metaBits.push(`Category: ${escapeHTML(service.category)}`);
  if (channels.phone) metaBits.push(`Phone: ${escapeHTML(channels.phone)}`);
  if (channels.email) metaBits.push(`Email: ${escapeHTML(channels.email)}`);
  meta.innerHTML = metaBits.join("<span>•</span>");
}

function openServiceContactModal(service = {}, settings = window.__serviceContactSettings || window.__sgcSettings || {}) {
  const modal = ensureServiceContactModal();
  if (!modal) return;

  const title = modal.querySelector("[data-service-contact-title]");
  const copy = modal.querySelector("[data-service-contact-copy]");
  if (title) title.textContent = String(service?.name || "Contact this service").trim();
  if (copy) copy.textContent = `Choose how you want to connect with S.Gamage Constructions about ${String(service?.name || "this service").trim()}.`;

  renderServiceContactOptions(service, settings);
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  const focusTarget = modal.querySelector(".contact-option-btn, [data-close-modal]");
  if (focusTarget) window.setTimeout(() => focusTarget.focus(), 0);
}


const DELIVERY_STATUS_META = {
  awaiting_advance_verification: {
    label: "Payment under review",
    hint: "Admin is checking the payment proof before your items are released for scheduling."
  },
  confirmed: {
    label: "Order confirmed",
    hint: "Advance verified. Stock is reserved and the order is ready for delivery planning."
  },
  scheduling_in_progress: {
    label: "Planning delivery",
    hint: "The team is checking route, load size, access notes and vehicle availability."
  },
  scheduled: {
    label: "Delivery scheduled",
    hint: "A delivery date or time window has been assigned for your order."
  },
  packed: {
    label: "Packed & ready",
    hint: "Your materials are packed and queued for loading onto the owner vehicle."
  },
  out_for_delivery: {
    label: "Out for delivery",
    hint: "The delivery boy has left with your order. Keep your site contact reachable."
  },
  arriving_soon: {
    label: "Arriving soon",
    hint: "The driver is nearby and preparing for handover."
  },
  delivered: {
    label: "Delivered",
    hint: "Goods were handed over and the delivery has been completed."
  },
  delivery_issue: {
    label: "Delivery issue",
    hint: "There was an access, timing or handover issue. The admin team will post the next update."
  },
  rescheduled: {
    label: "Rescheduled",
    hint: "A new delivery window is being arranged."
  },
  cancelled: {
    label: "Cancelled",
    hint: "This order / delivery was cancelled."
  }
};

const DELIVERY_TIME_SLOT_META = {
  morning_8_11: "Morning (8:00 AM - 11:00 AM)",
  midday_11_2: "Midday (11:00 AM - 2:00 PM)",
  afternoon_2_5: "Afternoon (2:00 PM - 5:00 PM)",
  full_day_8_5: "Full day route (8:00 AM - 5:00 PM)",
  call_to_confirm: "Call to confirm"
};

const UNLOADING_SUPPORT_META = {
  customer_team_available: "Customer / site team available to unload",
  delivery_boy_only: "Delivery boy only - site needs light unloading support",
  site_labour_required: "Site labour will be arranged by customer",
  forklift_available: "Forklift / machine available on site",
  unsure: "Will confirm by phone"
};

const BALANCE_COLLECTION_META = {
  before_dispatch: "Full payment before dispatch",
  cash_on_delivery: "Cash on delivery",
  bank_transfer_before_delivery: "Bank transfer before delivery",
  card_or_transfer_on_arrival: "Card / transfer on arrival",
  already_paid: "Already settled",
  to_be_confirmed: "To be confirmed"
};

function labelFromMap(map, value, fallback = "-") {
  return map[String(value || "").trim()] || String(value || fallback || "-");
}

function fmtDateOnly(value) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  } catch {
    return "-";
  }
}

function getClientDeliveryStatus(order = {}) {
  if (order?.delivery?.status) return String(order.delivery.status);
  if (["returned", "partially_returned", "delivered"].includes(String(order?.status || ""))) return "delivered";
  if (String(order?.status || "") === "confirmed") return "confirmed";
  if (String(order?.status || "") === "cancelled") return "cancelled";
  return "awaiting_advance_verification";
}

function getClientDelivery(order = {}) {
  const delivery = order?.delivery || {};
  const status = getClientDeliveryStatus(order);
  const base = {
    method: delivery.method || "own_vehicle",
    serviceLabel: delivery.serviceLabel || "Owner vehicle delivery",
    status,
    verificationCode: delivery.verificationCode || "----",
    siteContactName: delivery.siteContactName || order.customerName || "",
    siteContactPhone: delivery.siteContactPhone || order.phone || "",
    preferredDate: delivery.preferredDate || null,
    preferredTimeSlot: delivery.preferredTimeSlot || "call_to_confirm",
    scheduledDate: delivery.scheduledDate || null,
    scheduledWindow: delivery.scheduledWindow || "",
    driverName: delivery.driverName || "",
    driverPhone: delivery.driverPhone || "",
    vehicleNumber: delivery.vehicleNumber || "",
    accessNotes: delivery.accessNotes || "",
    requiresCallBeforeDelivery: delivery.requiresCallBeforeDelivery !== false,
    unloadingSupport: delivery.unloadingSupport || "unsure",
    balanceCollectionMode: delivery.balanceCollectionMode || "to_be_confirmed",
    allowSplitDelivery: delivery.allowSplitDelivery !== false,
    publicNote: delivery.publicNote || "",
    adminNote: delivery.adminNote || "",
    issueReason: delivery.issueReason || "",
    proofImageUrl: delivery.proofImageUrl || "",
    proofRecipientName: delivery.proofRecipientName || "",
    verificationCodeVerifiedAt: delivery.verificationCodeVerifiedAt || null,
    events: Array.isArray(delivery.events) ? delivery.events : []
  };

  if (!base.events.length) {
    base.events = [{
      status,
      title: DELIVERY_STATUS_META[status]?.label || "Delivery update",
      note: DELIVERY_STATUS_META[status]?.hint || "Delivery update available in your account.",
      actor: "system",
      createdAt: order.deliveredAt || order.confirmedAt || order.createdAt || null
    }];
  }

  return base;
}

async function renderPublicDeliveryProcess() {
  const stepsWrap = document.getElementById("publicDeliverySteps");
  const lead = document.getElementById("publicDeliveryPolicyLead");
  const coverage = document.getElementById("publicDeliveryPolicyCoverage");
  const windowEl = document.getElementById("publicDeliveryPolicyWindow");
  const access = document.getElementById("publicDeliveryPolicyAccess");
  const inspect = document.getElementById("publicDeliveryPolicyInspection");
  if (!stepsWrap && !lead && !coverage && !windowEl && !access && !inspect) return;

  let settings = {};
  try {
    settings = await getSiteSettings();
  } catch {
    settings = window.__sgcSettings || {};
  }

  if (lead) lead.textContent = settings.deliveryLeadTimeText || lead.textContent;
  if (coverage) coverage.textContent = settings.deliveryCoverageText || coverage.textContent;
  if (windowEl) windowEl.textContent = settings.deliveryWindowText || windowEl.textContent;
  if (access) access.textContent = settings.deliveryAccessTermsText || access.textContent;
  if (inspect) inspect.textContent = settings.deliveryInspectionText || inspect.textContent;

  if (stepsWrap) {
    stepsWrap.innerHTML = [
      {
        step: "01",
        title: "Payment submitted",
        copy: "Customer places the order, uploads the slip and submits site / unloading details from checkout."
      },
      {
        step: "02",
        title: "Admin verifies + confirms",
        copy: "Stock, payment and delivery notes are reviewed before the order is released for dispatch planning."
      },
      {
        step: "03",
        title: "Own vehicle scheduled",
        copy: "The owner vehicle and delivery boy are assigned, with a date / time window added to the customer account."
      },
      {
        step: "04",
        title: "Call before arrival",
        copy: "If requested, the driver calls first, then the order moves to out-for-delivery and arriving-soon updates."
      },
      {
        step: "05",
        title: "Inspect + handover",
        copy: "Customer checks the items, confirms receipt, and the balance is settled according to the agreed method."
      }
    ].map((item) => `
      <div class="delivery-step-card">
        <div class="delivery-step-no">${item.step}</div>
        <div>
          <div class="delivery-step-title">${item.title}</div>
          <div class="delivery-step-copy">${item.copy}</div>
        </div>
      </div>
    `).join("");
  }
}

async function renderCheckoutDeliveryGuide(form, settings = null) {
  const guide = document.getElementById("checkoutDeliveryGuide");
  if (!form || !guide) return;

  const s = settings || window.__sgcSettings || (await getSiteSettings().catch(() => ({})));
  const slot = labelFromMap(DELIVERY_TIME_SLOT_META, form.preferredTimeSlot?.value || "call_to_confirm", "Call to confirm");
  const unloading = labelFromMap(UNLOADING_SUPPORT_META, form.unloadingSupport?.value || "unsure", "Will confirm by phone");
  const balanceMode = labelFromMap(BALANCE_COLLECTION_META, form.balanceCollectionMode?.value || "to_be_confirmed", "To be confirmed");
  const preferredDate = form.preferredDate?.value ? fmtDateOnly(form.preferredDate.value) : "No specific date selected yet";
  const callAhead = form.requiresCallBeforeDelivery?.checked ? "Yes - call before arrival" : "No advance call needed";
  const splitDelivery = form.allowSplitDelivery?.checked ? "Yes - standard stock can come first" : "No - wait until the full order is ready";

  guide.innerHTML = `
    <div class="delivery-guide-grid">
      <div class="delivery-guide-stat">
        <span>Preferred date</span>
        <b>${escapeHTML(preferredDate)}</b>
      </div>
      <div class="delivery-guide-stat">
        <span>Preferred time slot</span>
        <b>${escapeHTML(slot)}</b>
      </div>
      <div class="delivery-guide-stat">
        <span>Unloading support</span>
        <b>${escapeHTML(unloading)}</b>
      </div>
      <div class="delivery-guide-stat">
        <span>Balance plan</span>
        <b>${escapeHTML(balanceMode)}</b>
      </div>
    </div>
    <ul class="delivery-guide-list">
      <li>${escapeHTML(s.deliveryCoverageText || "Deliveries are handled by the owner vehicle and in-house delivery staff.")}</li>
      <li>${escapeHTML(s.deliveryWindowText || "Admin will confirm a date / time window before dispatch.")}</li>
      <li><b>Call before arrival:</b> ${escapeHTML(callAhead)}</li>
      <li><b>Split delivery option:</b> ${escapeHTML(splitDelivery)}</li>
    </ul>
  `;
}

function stars(rating) {
  const r = Math.round(Number(rating) || 0);
  return "★★★★★☆☆☆☆☆".slice(5 - r, 10 - r);
}

async function loadServices(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  let items = [];
  let settings = {};

  try {
    [items, settings] = await Promise.all([
      fetchJSON(`${API_BASE}/services`),
      getSiteSettings().catch(() => window.__sgcSettings || {})
    ]);
  } catch (err) {
    grid.innerHTML = `
      <div class="panel">
        <div class="badge">Services unavailable</div>
        <h3 style="margin:8px 0 6px">Unable to load services right now</h3>
        <p style="color:var(--muted)">${escapeHTML(err.message || "Please try again later.")}</p>
      </div>
    `;
    return;
  }

  const list = Array.isArray(items) ? items : [];
  window.__serviceContactSettings = settings || {};
  window.__serviceContactMap = Object.create(null);

  if (!list.length) {
    grid.innerHTML = `
      <div class="panel">
        <div class="badge">No services yet</div>
        <p style="color:var(--muted)">Services will appear here once they are added from the admin panel.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map((service, index) => {
    const key = String(service?._id || `service-${index}`);
    window.__serviceContactMap[key] = service;
    const imageUrl = escapeHTML(service?.imageUrl || "https://images.unsplash.com/photo-1504307651254-35680f356dfd?fm=jpg&q=80&w=1600");
    const serviceName = escapeHTML(service?.name || "Service");
    const category = escapeHTML(service?.category || "General");
    const description = escapeHTML(service?.description || "Tell us about your requirement and we will respond with the best plan.");

    return `
      <article class="card service-card">
        <img src="${imageUrl}" alt="${serviceName}">
        <div class="body">
          <div class="badge">${category}</div>
          <h3>${serviceName}</h3>
          <p>${description}</p>
          <p class="service-price"><b>From:</b> LKR ${Number(service?.priceFromLKR || 0).toLocaleString()}</p>
          <div class="service-actions">
            <button class="btn service-contact-trigger" type="button" data-service-key="${escapeHTML(key)}">Contact Us</button>
            <small class="service-contact-note">Choose Normal Voice, WhatsApp Call, WhatsApp Msg, or Email for this service.</small>
          </div>
        </div>
      </article>
    `;
  }).join("");

  ensureServiceContactModal();
  grid.onclick = (e) => {
    const trigger = e.target.closest(".service-contact-trigger");
    if (!trigger) return;
    const serviceKey = trigger.getAttribute("data-service-key");
    const service = window.__serviceContactMap?.[serviceKey];
    if (service) openServiceContactModal(service, settings);
  };
}

async function loadProjects(gridId) {
  const items = await fetchJSON(`${API_BASE}/projects`);
  const grid = document.getElementById(gridId);
  grid.innerHTML = items.map(p => `
    <div class="card">
      <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?fm=jpg&q=80&w=1600'}" alt="${p.title}">
      <div class="body">
        <div class="badge">${p.category} • ${p.status}</div>
        <h3>${p.title}</h3>
        <p>${p.location ? p.location + " • " : ""}${p.year || ""}</p>
        <p style="margin-top:10px">
          <a class="btn" href="project.html?id=${p._id}">View Details</a>
        </p>
      </div>
    </div>
  `).join("");
}

async function loadProjectDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) return;

  const detail = await fetchJSON(`${API_BASE}/projects/${id}`);
  const { project, avgRating, reviewCount } = detail;

  document.getElementById("pTitle").textContent = project.title;
  document.getElementById("pMeta").textContent =
    `${project.category} • ${project.status} • ${project.location || "Sri Lanka"} • ${project.year || ""}`;
  document.getElementById("pDesc").textContent = project.description || "";
  document.getElementById("pImg").src = project.imageUrl || document.getElementById("pImg").src;
  document.getElementById("pRating").textContent = `${stars(avgRating)}  (${avgRating}/5 from ${reviewCount} reviews)`;

  await loadReviews(id);
  hookReviewForm(id);
}

async function loadReviews(projectId) {
  const items = await fetchJSON(`${API_BASE}/reviews/project/${projectId}`);
  const wrap = document.getElementById("reviewList");
  wrap.innerHTML = items.length ? items.map(r => `
    <div class="panel" style="margin-top:10px">
      <div class="badge">${stars(r.rating)} • ${r.rating}/5</div>
      <h3 style="margin:6px 0">${r.customerName}</h3>
      <p>${r.feedback}</p>
      <small style="color:var(--muted)">Posted: ${new Date(r.createdAt).toLocaleString()}</small>
    </div>
  `).join("") : `<p style="color:var(--muted)">No reviews yet. Be the first!</p>`;
}

function hookReviewForm(projectId) {
  const form = document.getElementById("reviewForm");
  const status = document.getElementById("reviewStatus");

  if (!form) return;

  // Gate before login
  const gate = async () => {
    if (!isCustomerLoggedIn()) {
      // disable all fields
      [...form.querySelectorAll("input,select,textarea,button")].forEach((el) => (el.disabled = true));
      if (status) {
        const paths = customerPaths();
        const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
        status.className = "status";
        status.innerHTML = `🔒 Please <a href="${paths.login}?next=${next}" style="color:#fff;text-decoration:underline">login</a> to submit a review.`;
      }
      return;
    }

    // logged in: enable + prefill name
    [...form.querySelectorAll("input,select,textarea,button")].forEach((el) => (el.disabled = false));
    const profile = getCustomerProfile() || (await fetchCustomerMe());
    if (profile?.fullName && form.customerName) {
      form.customerName.value = profile.fullName;
      form.customerName.readOnly = true;
    }
  };

  gate();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireCustomerLogin("Please login to submit a review")) return;
    status.textContent = "Submitting...";
    status.className = "status";

    const payload = {
      projectId,
      rating: Number(form.rating.value),
      feedback: form.feedback.value.trim()
    };

    try {
      await fetchJSONCustomer(`${API_BASE}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      status.textContent = "✅ Review submitted!";
      status.className = "status success";
      form.reset();
      await gate();
      await loadReviews(projectId);
    } catch (err) {
      status.textContent = "❌ " + err.message;
      status.className = "status error";
    }
  });
}

async function loadProducts(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const shopSearch = document.getElementById("shopSearch");
  const shopSort = document.getElementById("shopSort");
  const shopInStock = document.getElementById("shopInStock");
  const shopClearFilters = document.getElementById("shopClearFilters");
  const shopCategoryGrid = document.getElementById("shopCategoryGrid");
  const shopActiveFilters = document.getElementById("shopActiveFilters");
  const shopResultCount = document.getElementById("shopResultCount");
  const shopCategoryHint = document.getElementById("shopCategoryHint");
  const shopResultsSummary = document.getElementById("shopResultsSummary");
  const shopEmptyState = document.getElementById("shopEmptyState");

  const params = new URLSearchParams(location.search);
  const state = {
    q: (params.get("q") || "").trim(),
    category: (params.get("category") || "all").trim() || "all",
    sort: (params.get("sort") || "featured").trim() || "featured",
    inStockOnly: ["1", "true", "yes"].includes(String(params.get("inStock") || "").toLowerCase())
  };

  let allItems = [];
  let categories = [];

  try {
    const [items, categoryData] = await Promise.all([
      fetchJSON(`${API_BASE}/products`),
      fetchJSON(`${API_BASE}/products/categories`)
    ]);

    allItems = Array.isArray(items) ? items : [];
    categories = Array.isArray(categoryData) ? categoryData : [];
  } catch (err) {
    grid.innerHTML = `
      <div class="panel">
        <div class="badge">Shop unavailable</div>
        <h3 style="margin:8px 0 6px">Unable to load products right now</h3>
        <p style="color:var(--muted)">${escapeHTML(err.message || "Please try again later.")}</p>
      </div>
    `;
    return;
  }

  const allCategory = {
    key: "all",
    label: "All Products",
    icon: "🏪",
    description: "Browse the full hardware and construction range",
    count: allItems.length
  };
  categories = [allCategory, ...categories];

  if (!categories.some((category) => category.key === state.category)) {
    state.category = "all";
  }

  if (shopSearch) shopSearch.value = state.q;
  if (shopSort) shopSort.value = state.sort;
  if (shopInStock) shopInStock.checked = state.inStockOnly;
  if (shopResultsSummary) {
    const departmentCount = Math.max(categories.length - 1, 0);
    shopResultsSummary.textContent = `${departmentCount} curated departments`;
  }

  const categoryOrder = new Map(categories.map((item, index) => [item.key, index]));

  const getSearchText = (product) => [
    product.name,
    product.description,
    product.brand,
    product.category,
    product.subCategory,
    product.shopCategoryLabel,
    product.displaySubCategory,
    Array.isArray(product.tags) ? product.tags.join(" ") : ""
  ].join(" ").toLowerCase();

  const sortProducts = (items) => {
    const list = [...items];

    if (state.sort === "price_asc") {
      return list.sort((a, b) => Number(a.priceLKR || 0) - Number(b.priceLKR || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    }
    if (state.sort === "price_desc") {
      return list.sort((a, b) => Number(b.priceLKR || 0) - Number(a.priceLKR || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    }
    if (state.sort === "name_asc") {
      return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }
    if (state.sort === "newest") {
      return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || String(a.name || "").localeCompare(String(b.name || "")));
    }

    return list.sort((a, b) => {
      const stockRank = (item) => (Number(item.stockQty || 0) > 0 ? 0 : 1);
      return (
        stockRank(a) - stockRank(b) ||
        (categoryOrder.get(a.shopCategoryKey) ?? 999) - (categoryOrder.get(b.shopCategoryKey) ?? 999) ||
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    });
  };

  const getFilteredProducts = () => {
    const terms = state.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const filtered = allItems.filter((product) => {
      if (state.category !== "all" && product.shopCategoryKey !== state.category) return false;
      if (state.inStockOnly && Number(product.stockQty || 0) <= 0) return false;
      if (terms.length) {
        const haystack = getSearchText(product);
        if (!terms.every((term) => haystack.includes(term))) return false;
      }
      return true;
    });

    return sortProducts(filtered);
  };

  const syncUrl = () => {
    try {
      const next = new URLSearchParams();
      if (state.q) next.set("q", state.q);
      if (state.category !== "all") next.set("category", state.category);
      if (state.sort !== "featured") next.set("sort", state.sort);
      if (state.inStockOnly) next.set("inStock", "1");
      const nextUrl = `${location.pathname}${next.toString() ? `?${next.toString()}` : ""}`;
      history.replaceState(null, "", nextUrl);
    } catch {
      // ignore URL sync failures on static previews
    }
  };

  const bindProductButtons = (visibleItems) => {
    if (!isCustomerLoggedIn()) {
      grid.querySelectorAll(".add-to-cart").forEach((button) => {
        if (!button.disabled) button.textContent = "Login to add";
      });
      grid.querySelectorAll(".buy-now").forEach((button) => {
        if (!button.disabled) button.textContent = "Login to buy";
      });
    }

    grid.querySelectorAll(".add-to-cart").forEach((button) => {
      button.addEventListener("click", () => {
        if (!requireCustomerLogin("Please login to add items to cart")) return;
        const product = visibleItems.find((item) => item._id === button.dataset.id);
        if (product) addToCart(product, 1);
      });
    });

    grid.querySelectorAll(".buy-now").forEach((button) => {
      button.addEventListener("click", () => {
        if (!requireCustomerLogin("Please login to buy items")) return;
        const product = visibleItems.find((item) => item._id === button.dataset.id);
        if (product) {
          addToCart(product, 1);
          openCart();
        }
      });
    });
  };

  const renderCategoryCards = () => {
    if (!shopCategoryGrid) return;

    shopCategoryGrid.innerHTML = categories.map((category) => {
      const isActive = category.key === state.category;
      const count = Number(category.count || 0);
      return `
        <button type="button" class="shop-category-card ${isActive ? "active" : ""}" data-category="${escapeHTML(category.key)}">
          <div class="shop-category-icon">${escapeHTML(category.icon || "📦")}</div>
          <div>
            <div class="shop-category-title-row">
              <h4>${escapeHTML(category.label)}</h4>
              <span>${count}</span>
            </div>
            <p>${escapeHTML(category.description || "")}</p>
          </div>
        </button>
      `;
    }).join("");

    shopCategoryGrid.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        state.category = button.dataset.category || "all";
        rerender();
      });
    });
  };

  const renderActiveFilters = () => {
    if (!shopActiveFilters) return;
    const pills = [];
    const activeCategory = categories.find((item) => item.key === state.category) || categories[0];

    if (state.category !== "all") {
      pills.push(`<button type="button" class="filter-pill" data-clear="category">Category: ${escapeHTML(activeCategory.label)} <span>✕</span></button>`);
    }
    if (state.q) {
      pills.push(`<button type="button" class="filter-pill" data-clear="search">Search: ${escapeHTML(state.q)} <span>✕</span></button>`);
    }
    if (state.inStockOnly) {
      pills.push(`<button type="button" class="filter-pill" data-clear="stock">In stock only <span>✕</span></button>`);
    }

    shopActiveFilters.innerHTML = pills.length
      ? pills.join("")
      : `<span class="shop-muted-copy">Showing the full catalog. Use category cards or search to narrow down products.</span>`;

    shopActiveFilters.querySelectorAll("[data-clear]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.clear;
        if (action === "category") state.category = "all";
        if (action === "search") {
          state.q = "";
          if (shopSearch) shopSearch.value = "";
        }
        if (action === "stock") {
          state.inStockOnly = false;
          if (shopInStock) shopInStock.checked = false;
        }
        rerender();
      });
    });
  };

  const renderProductsGrid = () => {
    const visibleItems = getFilteredProducts();
    const activeCategory = categories.find((item) => item.key === state.category) || categories[0];

    if (shopResultCount) {
      shopResultCount.textContent = `Showing ${visibleItems.length} of ${allItems.length} products`;
    }
    if (shopCategoryHint) {
      shopCategoryHint.textContent = state.category === "all"
        ? "Browse all departments or search by material, brand or product name."
        : `${activeCategory.label} • ${activeCategory.description || "Filtered by selected department"}`;
    }

    if (shopEmptyState) {
      shopEmptyState.style.display = visibleItems.length ? "none" : "block";
    }

    grid.innerHTML = visibleItems.map((product) => {
      const stockQty = Number(product.stockQty || 0);
      const outOfStock = stockQty <= 0;
      const stockText = outOfStock
        ? "Out of stock"
        : product.stockStatus === "low-stock"
        ? `Only ${stockQty} left`
        : `${stockQty} in stock`;
      const detailLine = [product.displaySubCategory, product.brand].filter(Boolean).join(" • ");
      const imageUrl = product.imageUrl || "https://images.unsplash.com/photo-1581091215367-59ab6b9d8a1d?fm=jpg&q=80&w=1600";
      const returnPolicyLine = product.isReturnable !== false
        ? `Returns: unused standard-stock items within 14 days` + (Number(product.warrantyDays || 0) > 0 ? ` • Warranty ${Number(product.warrantyDays)} day(s)` : "")
        : (product.nonReturnableReason || "Custom/special-order item: no change-of-mind returns");

      return `
        <div class="card product-card" data-product-id="${product._id}">
          <img src="${imageUrl}" alt="${escapeHTML(product.name)}">
          <div class="body">
            <div class="product-topline">
              <div class="badge">${escapeHTML(product.displayCategory || product.shopCategoryLabel || product.category || "Hardware")}</div>
              <span class="stock-pill ${escapeHTML(product.stockStatus || "in-stock")}">${escapeHTML(stockText)}</span>
            </div>
            <h3>${escapeHTML(product.name)}</h3>
            ${detailLine ? `<div class="product-subcategory">${escapeHTML(detailLine)}</div>` : ""}
            <p class="product-desc">${escapeHTML(product.description || "Quality hardware product for your next project.")}</p>
            <div class="product-return-note">${escapeHTML(returnPolicyLine)}</div>
            <div class="product-price-row">
              <div class="product-price">LKR ${Number(product.priceLKR || 0).toLocaleString()}</div>
            </div>

            <div class="row" style="margin-top:12px;gap:10px;align-items:center">
              <button class="btn add-to-cart" data-id="${product._id}" ${outOfStock ? "disabled" : ""}>${outOfStock ? "Out of stock" : "Add to cart"}</button>
              <button class="btn ghost buy-now" data-id="${product._id}" ${outOfStock ? "disabled" : ""}>${outOfStock ? "Unavailable" : "Buy now"}</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    bindProductButtons(visibleItems);
  };

  const rerender = () => {
    syncUrl();
    renderCategoryCards();
    renderActiveFilters();
    renderProductsGrid();
  };

  let searchTimer;
  if (shopSearch) {
    shopSearch.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.q = shopSearch.value.trim();
        rerender();
      }, 140);
    });
  }

  if (shopSort) {
    shopSort.addEventListener("change", () => {
      state.sort = shopSort.value || "featured";
      rerender();
    });
  }

  if (shopInStock) {
    shopInStock.addEventListener("change", () => {
      state.inStockOnly = !!shopInStock.checked;
      rerender();
    });
  }

  if (shopClearFilters) {
    shopClearFilters.addEventListener("click", () => {
      state.q = "";
      state.category = "all";
      state.sort = "featured";
      state.inStockOnly = false;
      if (shopSearch) shopSearch.value = "";
      if (shopSort) shopSort.value = "featured";
      if (shopInStock) shopInStock.checked = false;
      rerender();
    });
  }

  rerender();
}


function hookInquiryForm() {
  const form = document.getElementById("inquiryForm");
  const status = document.getElementById("inqStatus");

  if (!form) return;

  try {
    const params = new URLSearchParams(location.search);
    const presetService = (params.get("service") || "").trim();
    const presetMessage = (params.get("message") || "").trim();

    if (form.service && presetService && !form.service.value) form.service.value = presetService;
    if (form.message && presetMessage && !form.message.value) form.message.value = presetMessage;
  } catch {
    // ignore query param prefills on static previews
  }

  const gate = async () => {
    if (!isCustomerLoggedIn()) {
      [...form.querySelectorAll("input,select,textarea,button")].forEach((el) => (el.disabled = true));
      if (status) {
        const paths = customerPaths();
        const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
        status.className = "status";
        status.innerHTML = `🔒 Please <a href="${paths.login}?next=${next}" style="color:#fff;text-decoration:underline">login</a> to send an inquiry.`;
      }
      return;
    }

    [...form.querySelectorAll("input,select,textarea,button")].forEach((el) => (el.disabled = false));
    const profile = getCustomerProfile() || (await fetchCustomerMe());
    if (profile) {
      if (form.name) {
        form.name.value = profile.fullName || "";
        form.name.readOnly = true;
      }
      if (form.phone) {
        form.phone.value = profile.phone || "";
        form.phone.readOnly = true;
      }
      if (form.email) {
        form.email.value = profile.email || "";
        form.email.readOnly = true;
      }
    }
  };

  gate();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireCustomerLogin("Please login to send an inquiry")) return;
    status.textContent = "Sending...";
    status.className = "status";

    const payload = {
      service: form.service.value.trim(),
      location: form.location.value.trim(),
      message: form.message.value.trim()
    };

    try {
      await fetchJSONCustomer(`${API_BASE}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      status.textContent = "✅ Sent! We will contact you soon.";
      status.className = "status success";
      form.reset();
      await gate();
    } catch (err) {
      status.textContent = "❌ " + err.message;
      status.className = "status error";
    }
  });
}


// ---------------- Careers / Jobs ----------------
async function loadJobs(gridId, searchInputId) {
  const grid = document.getElementById(gridId);
  const empty = document.getElementById("jobEmpty");
  const search = document.getElementById(searchInputId);

  let all = [];
  try {
    all = await fetchJSON(`${API_BASE}/jobs`);
  } catch (e) {
    grid.innerHTML = `<p style="color:var(--muted)">Failed to load jobs. Please try again later.</p>`;
    return;
  }

  function render(list) {
    grid.innerHTML = list.map(j => `
      <div class="card">
        <img src="${(j.imageUrl && j.imageUrl.trim()) ? j.imageUrl.trim() : "https://images.unsplash.com/photo-1504307651254-35680f356dfd?fm=jpg&q=80&w=1600"}" alt="${(j.title||'Job')}" />
        <div class="body">
          <div class="badge">${(j.department || "Hiring")} • ${(j.location || "Sri Lanka")}</div>
          <h3>${j.title}</h3>
          <div class="job-tags">
            <span class="tag">${j.employmentType || "Full-time"}</span>
            ${j.experienceLevel ? `<span class="tag">${j.experienceLevel}</span>` : ""}
            ${j.salaryRange ? `<span class="tag">${j.salaryRange}</span>` : ""}
          </div>
          <p style="margin-top:10px;color:var(--muted)">${(j.description || "").slice(0,140)}${(j.description||"").length>140?"...":""}</p>
          <p style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" data-apply="${j._id}">Apply Now</button>
            <button class="btn secondary" data-view="${j._id}">View</button>
          </p>
          ${j.closingDate ? `<small style="color:var(--muted)">Closing: ${new Date(j.closingDate).toLocaleDateString()}</small>` : ``}
        </div>
      </div>
    `).join("");

    empty.style.display = list.length ? "none" : "block";

    grid.querySelectorAll("[data-apply]").forEach(btn => btn.addEventListener("click", () => openApply(btn.dataset.apply)));
    grid.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => openApply(btn.dataset.view, true)));
  }

  function filterNow() {
    const q = (search?.value || "").toLowerCase().trim();
    const list = q
      ? all.filter(j => [j.title, j.department, j.location, j.employmentType, j.experienceLevel].join(" ").toLowerCase().includes(q))
      : all;
    render(list);
  }

  if (search) search.addEventListener("input", filterNow);
  filterNow();
}

function openApply(jobId, viewOnly = false) {
  if (!viewOnly && !isCustomerLoggedIn()) {
    requireCustomerLogin("Please login to apply for jobs");
    return;
  }

  const modal = document.getElementById("applyModal");
  const form = document.getElementById("applyForm");
  const status = document.getElementById("applyStatus");
  const closeBtn = document.getElementById("mCloseBtn");

  status.textContent = "";
  status.className = "status";

  fetchJSON(`${API_BASE}/jobs/${jobId}`)
    .then(job => {
      // header
      document.getElementById("mJobTitle").textContent = job.title || "Apply";
      document.getElementById("mJobDept").textContent = job.department || "Job";
      document.getElementById("mJobMeta").textContent = `${job.location || "Sri Lanka"} • ${job.employmentType || "Full-time"}${job.experienceLevel ? " • " + job.experienceLevel : ""}`;

      // When viewOnly, show description above form
      let desc = document.getElementById("mJobDesc");
      if (!desc) {
        desc = document.createElement("div");
        desc.id = "mJobDesc";
        desc.style.marginTop = "10px";
        form.parentElement.insertBefore(desc, form);
      }
      desc.innerHTML = `
        <div class="panel" style="margin:10px 0 0">
          <div class="badge">Job Details</div>
          <p style="margin-top:10px;white-space:pre-line">${job.description || ""}</p>
          ${job.responsibilities?.length ? `<p style="margin-top:12px"><b>Responsibilities</b></p><ul style="margin:6px 0 0 18px;color:var(--muted)">${job.responsibilities.map(x=>`<li>${x}</li>`).join("")}</ul>` : ""}
          ${job.requirements?.length ? `<p style="margin-top:12px"><b>Requirements</b></p><ul style="margin:6px 0 0 18px;color:var(--muted)">${job.requirements.map(x=>`<li>${x}</li>`).join("")}</ul>` : ""}
          ${job.benefits?.length ? `<p style="margin-top:12px"><b>Benefits</b></p><ul style="margin:6px 0 0 18px;color:var(--muted)">${job.benefits.map(x=>`<li>${x}</li>`).join("")}</ul>` : ""}
        </div>
      `;

      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      // Reset & set mode
      form.reset();
      form.dataset.jobId = jobId;
      form.style.display = viewOnly ? "none" : "block";

      // Prefill logged-in customer details
      if (!viewOnly) {
        (async () => {
          const profile = getCustomerProfile() || (await fetchCustomerMe());
          if (!profile) return;
          if (form.fullName && profile.fullName) {
            form.fullName.value = profile.fullName;
            form.fullName.readOnly = true;
          }
          if (form.phone && profile.phone) {
            form.phone.value = profile.phone;
            form.phone.readOnly = true;
          }
          if (form.email && profile.email) {
            form.email.value = profile.email;
            form.email.readOnly = true;
          }
          if (form.address && profile.address) {
            form.address.value = profile.address;
          }
        })();
      }
    })
    .catch(err => alert(err.message || err));

  const close = () => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  closeBtn.onclick = close;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); }, { once: true });

  if (!form.dataset.bound) {
    form.dataset.bound = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!requireCustomerLogin("Please login to apply")) return;
      status.textContent = "Submitting...";
      status.className = "status";
      const id = form.dataset.jobId;
      const payload = {
        fullName: form.fullName.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        address: form.address.value.trim(),
        experienceYears: Number(form.experienceYears.value || 0),
        currentRole: form.currentRole.value.trim(),
        expectedSalary: form.expectedSalary.value.trim(),
        cvLink: form.cvLink.value.trim(),
        message: form.message.value.trim()
      };

      try {
        await fetchJSONCustomer(`${API_BASE}/jobs/${id}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        status.textContent = "✅ Application submitted! We will contact you soon.";
        status.className = "status success";
        form.reset();
        // Refill locked identity fields
        const profile = getCustomerProfile() || (await fetchCustomerMe());
        if (profile) {
          if (form.fullName && profile.fullName) {
            form.fullName.value = profile.fullName;
            form.fullName.readOnly = true;
          }
          if (form.phone && profile.phone) {
            form.phone.value = profile.phone;
            form.phone.readOnly = true;
          }
          if (form.email && profile.email) {
            form.email.value = profile.email;
            form.email.readOnly = true;
          }
          if (form.address && profile.address) {
            form.address.value = profile.address;
          }
        }
      } catch (err) {
        status.textContent = "❌ " + err.message;
        status.className = "status error";
      }
    });
  }
}


/* -----------------------------
   Simple Cart + Advance Checkout
------------------------------*/
const CART_KEY = "sgc_cart_v1";

function toast(msg){
  const el = document.getElementById("toast");
  if (!el){
    alert(msg);
    return;
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>el.classList.remove("show"), 2200);
}

function moneyLKR(value) {
  return `LKR ${Number(value || 0).toLocaleString()}`;
}

function getCheckoutSettingsSnapshot() {
  return window.__sgcSettings || {};
}

function getCheckoutAdvanceSummary(totalLKR, settings = {}) {
  const pct = Math.min(100, Math.max(0, Number(settings.orderAdvancePercent || 25)));
  const advanceDueLKR = Math.max(0, Math.round((Number(totalLKR || 0) * pct) / 100));
  const balanceDueLKR = Math.max(0, Math.round(Number(totalLKR || 0) - advanceDueLKR));
  return {
    totalLKR: Math.max(0, Math.round(Number(totalLKR || 0))),
    advancePercent: pct,
    advanceDueLKR,
    balanceDueLKR
  };
}

function isFullPaymentBeforeDispatch(balanceCollectionMode = "") {
  return String(balanceCollectionMode || "").trim() === "before_dispatch";
}

function getCheckoutPaymentSummary(totalLKR, settings = {}, balanceCollectionMode = "") {
  const total = Math.max(0, Math.round(Number(totalLKR || 0)));
  if (isFullPaymentBeforeDispatch(balanceCollectionMode)) {
    return {
      totalLKR: total,
      advancePercent: total > 0 ? 100 : 0,
      advanceDueLKR: total,
      balanceDueLKR: 0,
      requiresFullPayment: true,
      paymentFlowTitle: "Full Payment Required",
      payNowLabel: "Full payment required now",
      laterLabel: "Balance later",
      confirmText: "I have paid the full order amount and I agree to the payment terms shown above.",
      footerText: "This checkout is optimized for real-world hardware orders: because you selected full payment before dispatch, upload the full payment proof now and the order will stay pending until admin verifies it.",
      primaryTermsText: "Full payment is required now because you selected full payment before dispatch.",
      secondaryTermsText: "No balance will remain after this payment is verified."
    };
  }

  const advance = getCheckoutAdvanceSummary(total, settings);
  return {
    ...advance,
    requiresFullPayment: false,
    paymentFlowTitle: "Advance Payment Required",
    payNowLabel: `Advance required now (${Number(advance.advancePercent)}%)`,
    laterLabel: "Balance later",
    confirmText: "I have paid the required advance and I agree to the payment terms shown above.",
    footerText: "This checkout is optimized for real-world hardware orders: customer pays the advance first, uploads proof, then the order stays pending until admin verifies and confirms the order.",
    primaryTermsText: settings.advanceTermsText || "An advance payment is required before order confirmation.",
    secondaryTermsText: settings.balanceTermsText || "The balance is settled before dispatch, on delivery, or at collection."
  };
}

function isFullPaymentOrder(order = {}) {
  return isFullPaymentBeforeDispatch(order?.delivery?.balanceCollectionMode) && Number(order?.balanceDueLKR || 0) === 0;
}

function getEnabledCheckoutMethods(settings = {}) {
  const methods = [];

  if (settings.bankTransferEnabled !== false) {
    methods.push({
      key: "bank_transfer",
      label: "Bank Transfer",
      sub: [settings.bankName, settings.bankAccountNumber].filter(Boolean).join(" • ") || "Transfer to business bank account"
    });
  }

  if (settings.cashDepositEnabled !== false) {
    methods.push({
      key: "cash_deposit",
      label: "Cash Deposit Slip",
      sub: [settings.bankName, settings.bankBranch].filter(Boolean).join(" • ") || "Deposit cash to bank account"
    });
  }

  if (settings.mobileBankingEnabled !== false) {
    methods.push({
      key: "mobile_banking",
      label: "Mobile Banking / App Transfer",
      sub: [settings.mobileBankingName, settings.mobileBankingNumber].filter(Boolean).join(" • ") || "Pay from bank app or wallet"
    });
  }

  if (settings.skrillEnabled) {
    methods.push({
      key: "skrill",
      label: "Skrill",
      sub: settings.skrillEmail || "Send advance to Skrill wallet"
    });
  }

  if (settings.cryptoEnabled) {
    methods.push({
      key: "crypto",
      label: `${settings.cryptoCurrency || "Crypto"} (${settings.cryptoNetwork || "Network"})`,
      sub: settings.cryptoWalletAddress ? `Wallet ready • Upload proof + TX hash` : "Upload proof + TX hash"
    });
  }

  return methods;
}

function getPaymentMethodDetailHTML(methodKey, settings = {}, summary = { advanceDueLKR: 0, requiresFullPayment: false }) {
  const introLabel = summary.requiresFullPayment ? "Full payment required now:" : "Required advance now:";
  const intro = `<p class="order-payment-copy"><b>${introLabel}</b> ${moneyLKR(summary.advanceDueLKR)}</p>`;

  if (methodKey === "bank_transfer") {
    return `
      ${intro}
      <ul class="payment-detail-list">
        <li><b>Bank:</b> ${escapeHTML(settings.bankName || "Add in admin settings")}</li>
        <li><b>Branch:</b> ${escapeHTML(settings.bankBranch || "Add in admin settings")}</li>
        <li><b>Account Name:</b> ${escapeHTML(settings.bankAccountName || "Add in admin settings")}</li>
        <li><b>Account Number:</b> ${escapeHTML(settings.bankAccountNumber || "Add in admin settings")}</li>
      </ul>
      ${settings.bankInstructions ? `<p class="order-payment-copy">${escapeHTML(settings.bankInstructions)}</p>` : ""}
    `;
  }

  if (methodKey === "cash_deposit") {
    return `
      ${intro}
      <ul class="payment-detail-list">
        <li><b>Deposit Bank:</b> ${escapeHTML(settings.bankName || "Add in admin settings")}</li>
        <li><b>Branch:</b> ${escapeHTML(settings.bankBranch || "Add in admin settings")}</li>
        <li><b>Account Name:</b> ${escapeHTML(settings.bankAccountName || "Add in admin settings")}</li>
        <li><b>Account Number:</b> ${escapeHTML(settings.bankAccountNumber || "Add in admin settings")}</li>
      </ul>
      ${settings.cashDepositInstructions ? `<p class="order-payment-copy">${escapeHTML(settings.cashDepositInstructions)}</p>` : ""}
    `;
  }

  if (methodKey === "mobile_banking") {
    return `
      ${intro}
      <ul class="payment-detail-list">
        <li><b>Receiver Name:</b> ${escapeHTML(settings.mobileBankingName || "Add in admin settings")}</li>
        <li><b>Receiver Number / ID:</b> ${escapeHTML(settings.mobileBankingNumber || "Add in admin settings")}</li>
      </ul>
      ${settings.mobileBankingInstructions ? `<p class="order-payment-copy">${escapeHTML(settings.mobileBankingInstructions)}</p>` : ""}
    `;
  }

  if (methodKey === "skrill") {
    return `
      ${intro}
      <ul class="payment-detail-list">
        <li><b>Skrill Email:</b> ${escapeHTML(settings.skrillEmail || "Add in admin settings")}</li>
      </ul>
      ${settings.skrillInstructions ? `<p class="order-payment-copy">${escapeHTML(settings.skrillInstructions)}</p>` : ""}
    `;
  }

  if (methodKey === "crypto") {
    return `
      ${intro}
      <ul class="payment-detail-list">
        <li><b>Currency:</b> ${escapeHTML(settings.cryptoCurrency || "USDT")}</li>
        <li><b>Network:</b> ${escapeHTML(settings.cryptoNetwork || "TRC20")}</li>
      </ul>
      <code>${escapeHTML(settings.cryptoWalletAddress || "Add wallet address in admin settings")}</code>
      ${settings.cryptoInstructions ? `<p class="order-payment-copy">${escapeHTML(settings.cryptoInstructions)}</p>` : ""}
      ${settings.cryptoQrImageUrl ? `<div class="payment-detail-qr"><img src="${escapeHTML(settings.cryptoQrImageUrl)}" alt="Crypto QR Code"></div>` : ""}
    `;
  }

  return `<p class="order-payment-copy">Choose a payment method to see instructions.</p>`;
}

function renderProofPreview(files = []) {
  const wrap = document.getElementById("checkoutProofPreview");
  if (!wrap) return;
  const list = Array.from(files || []).filter(Boolean).slice(0, 5);
  if (!list.length) {
    wrap.innerHTML = `<div class="order-payment-copy">No slip selected yet.</div>`;
    return;
  }

  wrap.innerHTML = list
    .map((file) => {
      const isImage = String(file.type || "").startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : "";
      return `
        <div class="proof-preview-item">
          ${previewUrl ? `<img src="${previewUrl}" alt="Slip preview">` : ""}
          <div>
            <div>${escapeHTML(file.name || "payment-proof")}</div>
            <small>${Math.round(Number(file.size || 0) / 1024)} KB</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const cart = raw ? JSON.parse(raw) : { items: [] };
    if (!cart.items) cart.items = [];
    return cart;
  } catch {
    return { items: [] };
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  document.querySelectorAll('#cartCount, #cartCountDrawer').forEach((el) => {
    el.textContent = String(count);
  });
}

function addToCart(product, qty = 1) {
  if (!isCustomerLoggedIn()) {
    requireCustomerLogin("Please login to add items to cart");
    return;
  }

  const availableStock = Number(product.stockQty || 0);
  if (availableStock <= 0) {
    toast(`${product.name} is currently out of stock`);
    return;
  }

  const cart = getCart();
  const id = product._id;
  const existing = cart.items.find(it => it.productId === id);

  if (existing) {
    const nextQty = Number(existing.qty || 0) + Number(qty || 1);
    if (nextQty > availableStock) {
      toast(`Only ${availableStock} item(s) available for ${product.name}`);
      return;
    }
    existing.qty = nextQty;
    existing.stockQty = availableStock;
  } else {
    cart.items.push({
      productId: id,
      name: product.name,
      priceLKR: Number(product.priceLKR || 0),
      imageUrl: product.imageUrl || "",
      stockQty: availableStock,
      qty: Number(qty || 1)
    });
  }

  saveCart(cart);
  toast(`${product.name} added to cart`);
}

function removeFromCart(productId) {
  const cart = getCart();
  cart.items = cart.items.filter(it => it.productId !== productId);
  saveCart(cart);
  renderCart();
}

function setQty(productId, qty) {
  const cart = getCart();
  const it = cart.items.find(x => x.productId === productId);
  if (!it) return;

  const requestedQty = Math.max(1, Number(qty || 1));
  const maxQty = Number(it.stockQty || 0);
  it.qty = maxQty > 0 ? Math.min(requestedQty, maxQty) : requestedQty;
  if (maxQty > 0 && requestedQty > maxQty) {
    toast(`Only ${maxQty} item(s) available for ${it.name}`);
  }
  saveCart(cart);
  renderCart();
}

function cartTotalLKR() {
  const cart = getCart();
  return cart.items.reduce((sum, it) => sum + (Number(it.priceLKR) * Number(it.qty || 0)), 0);
}

async function hydrateCheckoutIdentity(form) {
  if (!form || !isCustomerLoggedIn()) return;
  const profile = getCustomerProfile() || (await fetchCustomerMe());
  if (!profile) return;
  if (form.customerName && profile.fullName) {
    form.customerName.value = profile.fullName;
    form.customerName.readOnly = true;
  }
  if (form.phone && profile.phone) {
    form.phone.value = profile.phone;
    form.phone.readOnly = true;
  }
  if (form.address && profile.address && !form.address.value) {
    form.address.value = profile.address;
  }

  if (form.siteContactName && profile.fullName && !form.siteContactName.value) {
    form.siteContactName.value = profile.fullName;
  }
  if (form.siteContactPhone && profile.phone && !form.siteContactPhone.value) {
    form.siteContactPhone.value = profile.phone;
  }
  if (form.preferredDate) {
    const today = new Date();
    form.preferredDate.min = today.toISOString().slice(0, 10);
  }

  renderCheckoutDeliveryGuide(form).catch(() => {});
}

async function renderCheckoutPaymentUI(form) {
  if (!form) return;

  const summaryBox = document.getElementById("checkoutAdvanceSummary");
  const termsBox = document.getElementById("checkoutTermsBox");
  const methodsBox = document.getElementById("checkoutPaymentMethods");
  const detailBox = document.getElementById("checkoutPaymentMethodDetails");
  if (!summaryBox || !termsBox || !methodsBox || !detailBox) return;

  summaryBox.innerHTML = `<div class="order-payment-copy">Loading payment settings...</div>`;
  methodsBox.innerHTML = "";
  detailBox.innerHTML = `<div class="order-payment-copy">Choose a payment method to see instructions.</div>`;

  let settings = {};
  try {
    settings = await getSiteSettings();
  } catch {
    settings = getCheckoutSettingsSnapshot();
  }

  const summary = getCheckoutPaymentSummary(
    cartTotalLKR(),
    settings,
    form.balanceCollectionMode?.value || "to_be_confirmed"
  );
  const paymentFlowBadge = document.getElementById("checkoutPaymentFlowBadge");
  const paymentConfirmText = document.getElementById("checkoutPaymentConfirmText");
  const footerNote = document.getElementById("checkoutFooterNote");

  if (paymentFlowBadge) paymentFlowBadge.textContent = summary.paymentFlowTitle;
  if (paymentConfirmText) paymentConfirmText.textContent = summary.confirmText;
  if (footerNote) footerNote.textContent = summary.footerText;

  summaryBox.innerHTML = `
    <div class="advance-summary-stats">
      <div class="advance-summary-stat">
        <span>Order total</span>
        <b>${moneyLKR(summary.totalLKR)}</b>
      </div>
      <div class="advance-summary-stat">
        <span>${escapeHTML(summary.payNowLabel)}</span>
        <b>${moneyLKR(summary.advanceDueLKR)}</b>
      </div>
      <div class="advance-summary-stat">
        <span>${escapeHTML(summary.laterLabel)}</span>
        <b>${moneyLKR(summary.balanceDueLKR)}</b>
      </div>
    </div>
  `;

  termsBox.innerHTML = `
    <ul>
      <li>${escapeHTML(summary.primaryTermsText)}</li>
      <li>${escapeHTML(summary.secondaryTermsText)}</li>
      <li>${escapeHTML(settings.cancellationTermsText || "Custom / special-order materials may not be cancellable after procurement begins.")}</li>
    </ul>
  `;

  const methods = getEnabledCheckoutMethods(settings);
  if (!methods.length) {
    methodsBox.innerHTML = `<div class="order-payment-copy">No payment methods are configured yet. Please update admin settings.</div>`;
    return;
  }

  const currentSelected = form.querySelector('input[name="paymentMethod"]:checked')?.value;
  const selectedKey = methods.some((item) => item.key === currentSelected) ? currentSelected : methods[0].key;

  methodsBox.innerHTML = methods
    .map((method) => `
      <label class="payment-method-option ${method.key === selectedKey ? "active" : ""}" data-method-option="${method.key}">
        <input type="radio" name="paymentMethod" value="${method.key}" ${method.key === selectedKey ? "checked" : ""}>
        <span>
          <span class="payment-method-option-title">${escapeHTML(method.label)}</span>
          <span class="payment-method-option-sub">${escapeHTML(method.sub || "")}</span>
        </span>
      </label>
    `)
    .join("");

  const updateSelectedMethodUI = () => {
    const activeKey = form.querySelector('input[name="paymentMethod"]:checked')?.value || methods[0].key;
    methodsBox.querySelectorAll("[data-method-option]").forEach((label) => {
      label.classList.toggle("active", label.getAttribute("data-method-option") === activeKey);
    });
    detailBox.innerHTML = getPaymentMethodDetailHTML(activeKey, settings, summary);

    if (form.paymentReference) {
      form.paymentReference.placeholder = activeKey === "crypto"
        ? "Optional wallet/app reference"
        : activeKey === "skrill"
        ? "Skrill payment reference"
        : "Bank ref / slip no. / receipt no.";
    }
    if (form.cryptoTxHash) {
      form.cryptoTxHash.disabled = activeKey !== "crypto";
      if (activeKey !== "crypto") form.cryptoTxHash.value = "";
    }
  };

  methodsBox.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener("change", updateSelectedMethodUI);
  });
  updateSelectedMethodUI();
  renderCheckoutDeliveryGuide(form, settings).catch(() => {});
}

function openCart() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  if (!drawer) return;
  drawer.classList.add("open");
  if (overlay) overlay.classList.add("open");
  document.body.classList.add("cart-open");
  renderCart();
}

function closeCart() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  if (!drawer) return;
  drawer.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
  document.body.classList.remove("cart-open");
}

function renderCart() {
  const list = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  const emptyEl = document.getElementById("cartEmpty");
  const checkoutBtn = document.getElementById("checkoutBtn");
  const checkoutForm = document.getElementById("checkoutForm");

  if (!list) return;

  const cart = getCart();
  if (emptyEl) emptyEl.style.display = cart.items.length ? "none" : "block";
  if (checkoutBtn) checkoutBtn.disabled = cart.items.length === 0;

  list.innerHTML = cart.items.map(it => `
    <div class="cart-item">
      <img src="${it.imageUrl || 'https://images.unsplash.com/photo-1581091215367-59ab6b9d8a1d?fm=jpg&q=80&w=400'}" alt="${escapeHTML(it.name)}">
      <div class="cart-item-body">
        <div class="cart-item-title">${escapeHTML(it.name)}</div>
        <div class="cart-item-sub">LKR ${Number(it.priceLKR).toLocaleString()}</div>

        <div class="cart-qty">
          <button class="qty-btn" data-action="dec" data-id="${it.productId}">−</button>
          <input class="qty-input" type="number" min="1" max="${Number(it.stockQty || 9999)}" value="${Number(it.qty || 1)}" data-id="${it.productId}" />
          <button class="qty-btn" data-action="inc" data-id="${it.productId}">+</button>
          <button class="link danger" data-action="remove" data-id="${it.productId}">Remove</button>
        </div>
      </div>
      <div class="cart-item-line">
        LKR ${(Number(it.priceLKR) * Number(it.qty || 0)).toLocaleString()}
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const cartNow = getCart();
      const itNow = cartNow.items.find(x => x.productId === id);
      if (!itNow) return;
      const delta = btn.dataset.action === "inc" ? 1 : -1;
      setQty(id, Math.max(1, Number(itNow.qty || 1) + delta));
    });
  });

  list.querySelectorAll(".qty-input").forEach(inp => {
    inp.addEventListener("change", () => {
      setQty(inp.dataset.id, inp.value);
    });
  });

  list.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener("click", () => removeFromCart(btn.dataset.id));
  });

  if (totalEl) totalEl.textContent = moneyLKR(cartTotalLKR());
  if (checkoutForm) renderCheckoutPaymentUI(checkoutForm);
}

async function placeOrderFromCart(form) {
  if (!requireCustomerLogin("Please login to place an order")) return;

  const cart = getCart();
  if (!cart.items.length) {
    toast("Cart is empty");
    return;
  }

  const method = form.querySelector('input[name="paymentMethod"]:checked')?.value || "";
  const proofFiles = Array.from(form.paymentProof?.files || []).filter(Boolean).slice(0, 5);
  const status = document.getElementById("checkoutStatus");
  const requiresFullPayment = isFullPaymentBeforeDispatch(form.balanceCollectionMode?.value || "");

  if (!method) {
    if (status) {
      status.textContent = "Please choose a payment method.";
      status.className = "status error";
    }
    return;
  }

  if (!form.advanceConfirmed?.checked) {
    if (status) {
      status.textContent = requiresFullPayment
        ? "Please confirm that you have paid the full order amount and accepted the terms."
        : "Please confirm that you have paid the required advance and accepted the terms.";
      status.className = "status error";
    }
    return;
  }

  if (!proofFiles.length) {
    if (status) {
      status.textContent = requiresFullPayment
        ? "Please upload the full payment slip / screenshot before placing the order."
        : "Please upload the payment slip / screenshot before placing the order.";
      status.className = "status error";
    }
    return;
  }

  if (method === "crypto" && !String(form.cryptoTxHash?.value || "").trim()) {
    if (status) {
      status.textContent = "Please enter the crypto transaction hash.";
      status.className = "status error";
    }
    return;
  }

  if (status) { status.textContent = "Uploading payment proof..."; status.className = "status"; }

  try {
    const paymentProofImages = await uploadPaymentProof(proofFiles);

    if (status) { status.textContent = "Creating your order..."; status.className = "status"; }

    const out = await fetchJSONCustomer(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: form.address.value.trim(),
        items: cart.items.map(it => ({ productId: it.productId, qty: Number(it.qty || 1) })),
        paymentMethod: method,
        paymentProofImages,
        paymentReference: form.paymentReference.value.trim(),
        paymentNote: form.paymentNote.value.trim(),
        cryptoTxHash: form.cryptoTxHash.value.trim(),
        siteContactName: (form.siteContactName?.value || form.customerName?.value || "").trim(),
        siteContactPhone: (form.siteContactPhone?.value || form.phone?.value || "").trim(),
        preferredDate: (form.preferredDate?.value || "").trim(),
        preferredTimeSlot: form.preferredTimeSlot?.value || "call_to_confirm",
        accessNotes: form.accessNotes?.value?.trim() || "",
        unloadingSupport: form.unloadingSupport?.value || "unsure",
        balanceCollectionMode: form.balanceCollectionMode?.value || "to_be_confirmed",
        requiresCallBeforeDelivery: !!form.requiresCallBeforeDelivery?.checked,
        allowSplitDelivery: !!form.allowSplitDelivery?.checked
      })
    });

    localStorage.removeItem(CART_KEY);
    updateCartCount();
    renderCart();

    if (status) {
      const orderNo = escapeHTML(out?.order?.orderNumber || out?.order?._id || "new order");
      const whatsappAction = out?.whatsappUrl
        ? `<a class="btn ghost" href="${escapeHTML(out.whatsappUrl)}" target="_blank" rel="noopener noreferrer">Send to WhatsApp</a>`
        : "";
      const verificationCode = escapeHTML(out?.order?.delivery?.verificationCode || "");
      const fullPaymentOrder = !!out?.paymentSummary?.requiresFullPayment || requiresFullPayment;
      status.className = "status success";
      status.innerHTML = `
        ✅ Order ${orderNo} submitted with ${fullPaymentOrder ? "full payment proof" : "advance proof"}. Admin will now verify the ${fullPaymentOrder ? "payment" : "slip"}, confirm the delivery plan, and update your customer dashboard timeline.
        ${verificationCode ? `<div class="checkout-delivery-code">Delivery confirmation code: <b>${verificationCode}</b></div>` : ""}
        <div class="checkout-success-actions">
          ${whatsappAction}
          <a class="btn ghost" href="${escapeHTML(customerPaths().dashboard)}">View My Orders</a>
        </div>
      `;
    }

    if (out?.whatsappUrl) {
      try { window.open(out.whatsappUrl, "_blank", "noopener"); } catch {}
    }

    form.reset();
    await hydrateCheckoutIdentity(form);
    renderProofPreview([]);
    await renderCheckoutPaymentUI(form);
    await renderCheckoutDeliveryGuide(form);
  } catch (err) {
    if (status) { status.textContent = `❌ ${err.message}`; status.className = "status error"; }
  }
}

function initCart() {
  const cartBtn = document.getElementById("cartBtn");
  const overlay = document.getElementById("cartOverlay");
  const closeBtn = document.getElementById("cartClose");
  const checkoutForm = document.getElementById("checkoutForm");

  if (cartBtn) cartBtn.addEventListener("click", async () => {
    if (!requireCustomerLogin("Please login to access your cart")) return;
    openCart();
  });
  if (overlay) overlay.addEventListener("click", closeCart);
  if (closeBtn) closeBtn.addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });

  if (checkoutForm) {
    (async () => {
      if (!isCustomerLoggedIn()) return;
      await hydrateCheckoutIdentity(checkoutForm);
      await renderCheckoutPaymentUI(checkoutForm);
    })();

    if (checkoutForm.paymentProof) {
      checkoutForm.paymentProof.addEventListener("change", () => {
        renderProofPreview(checkoutForm.paymentProof.files || []);
      });
      renderProofPreview([]);
    }

    [
      "siteContactName",
      "siteContactPhone",
      "preferredDate",
      "preferredTimeSlot",
      "unloadingSupport",
      "balanceCollectionMode",
      "requiresCallBeforeDelivery",
      "allowSplitDelivery",
      "accessNotes"
    ].forEach((fieldName) => {
      const field = checkoutForm.elements?.[fieldName];
      if (!field) return;
      const handler = () => {
        renderCheckoutDeliveryGuide(checkoutForm).catch(() => {});
        if (fieldName === "balanceCollectionMode") {
          renderCheckoutPaymentUI(checkoutForm).catch(() => {});
        }
      };
      field.addEventListener("change", handler);
      if (["TEXTAREA", "INPUT"].includes(field.tagName)) field.addEventListener("input", handler);
    });

    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await placeOrderFromCart(checkoutForm);
    });
  }

  updateCartCount();
}

// -----------------------------
// Customer Pages
// -----------------------------

function initCustomerRegisterForm() {
  const form = document.getElementById("customerRegisterForm");
  const status = document.getElementById("customerRegisterStatus");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (status) {
      status.textContent = "Creating account...";
      status.className = "status";
    }

    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();
    const password = form.password.value;
    const confirm = form.confirmPassword.value;

    if (password !== confirm) {
      if (status) {
        status.textContent = "❌ Passwords do not match";
        status.className = "status error";
      }
      return;
    }

    try {
      await fetchJSON(`${API_BASE}/customers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, address, password })
      });

      if (status) {
        status.textContent = "✅ Registered! Redirecting to login...";
        status.className = "status success";
      }

      // As requested: after registration, show login panel
      const paths = customerPaths();
      setTimeout(() => {
        location.href = `${paths.login}?registered=1&email=${encodeURIComponent(email)}`;
      }, 650);
    } catch (err) {
      if (status) {
        status.textContent = "❌ " + err.message;
        status.className = "status error";
      }
    }
  });
}

function initCustomerLoginForm() {
  const form = document.getElementById("customerLoginForm");
  const status = document.getElementById("customerLoginStatus");
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const emailFromRegister = params.get("email");
  if (emailFromRegister && form.emailOrPhone) form.emailOrPhone.value = emailFromRegister;

  if (params.get("registered") === "1" && status) {
    status.textContent = "✅ Registration successful. Please login.";
    status.className = "status success";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (status) {
      status.textContent = "Logging in...";
      status.className = "status";
    }

    const emailOrPhone = form.emailOrPhone.value.trim();
    const password = form.password.value;

    try {
      const data = await fetchJSON(`${API_BASE}/customers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password })
      });

      setCustomerSession(data.token, data.customer);
      initCustomerNav();

      const next = params.get("next");
      const paths = customerPaths();
      location.href = next ? decodeURIComponent(next) : paths.dashboard;
    } catch (err) {
      if (status) {
        status.textContent = "❌ " + err.message;
        status.className = "status error";
      }
    }
  });
}

function initCustomerDashboard() {
  const wrap = document.getElementById("customerDashboard");
  if (!wrap) return;
  if (!isCustomerLoggedIn()) {
    requireCustomerLogin("Please login to view your account");
    return;
  }

  const elName = document.getElementById("custName");
  const elEmail = document.getElementById("custEmail");
  const elPhone = document.getElementById("custPhone");
  const elAddr = document.getElementById("custAddress");
  const profileForm = document.getElementById("customerProfileForm");
  const profileStatus = document.getElementById("customerProfileStatus");

  const ordersList = document.getElementById("myOrders");
  const inquiriesList = document.getElementById("myInquiries");
  const reviewsList = document.getElementById("myReviews");
  const appsList = document.getElementById("myApplications");

  const RETURN_REASON_META = {
    damaged_on_arrival: { label: "Damaged on arrival", window: "Report within 48 hours" },
    wrong_item_or_missing_parts: { label: "Wrong item / missing parts", window: "Report within 48 hours" },
    defective_or_quality_issue: { label: "Defective / quality issue", window: "Report within 7 days" },
    unused_unopened: { label: "Unused / unopened standard item", window: "Unused standard stock within 14 days" }
  };

  const RETURN_RESOLUTION_META = {
    replacement: "Replacement",
    refund: "Refund",
    exchange: "Exchange",
    store_credit: "Store credit",
    repair: "Repair",
    warranty_support: "Warranty support"
  };

  const RETURN_STATUS_META = {
    requested: "Requested",
    under_review: "Under review",
    approved: "Approved",
    awaiting_item: "Awaiting item handover",
    received: "Item received",
    completed: "Completed",
    rejected: "Rejected",
    cancelled: "Cancelled"
  };

  const PAYMENT_STATUS_META = {
    none: "None",
    advance_required: "Advance required",
    advance_submitted: "Advance submitted - awaiting verification",
    advance_received: "Advance received",
    balance_pending: "Balance pending",
    paid: "Paid in full",
    partially_refunded: "Partial refund issued",
    refunded: "Refund completed",
    failed: "Payment issue"
  };

  const getDeliveryMetaForOrder = (order) => {
    const statusKey = getClientDeliveryStatus(order);
    return DELIVERY_STATUS_META[statusKey] || DELIVERY_STATUS_META.awaiting_advance_verification;
  };

  const getDeliveryNextStepText = (order) => {
    const statusKey = getClientDeliveryStatus(order);
    if (statusKey === "awaiting_advance_verification") {
      return isFullPaymentOrder(order)
        ? "Admin will verify the full payment slip and confirm the order before scheduling delivery."
        : "Admin will verify the advance slip and confirm the order before scheduling delivery.";
    }
    if (statusKey === "confirmed") return "Next step: the team will assign a vehicle route and schedule your delivery window.";
    if (statusKey === "scheduling_in_progress") return "Next step: watch for the confirmed date / time window in this dashboard.";
    if (statusKey === "scheduled") return "Next step: items will be packed and loaded for the scheduled route.";
    if (statusKey === "packed") return "Next step: the owner vehicle will be dispatched on the scheduled route.";
    if (statusKey === "out_for_delivery") return "Next step: keep your site contact reachable and prepare the unloading point.";
    if (statusKey === "arriving_soon") return "Next step: inspect the materials at handover and share the delivery code if asked.";
    if (statusKey === "delivered") return "Delivery complete. Check the materials and use the return window if any visible issue needs to be reported.";
    if (statusKey === "delivery_issue") return "The admin team will review the issue and either reschedule the route or contact you for clarification.";
    if (statusKey === "rescheduled") return "A fresh delivery slot will be posted here after route planning is completed.";
    if (statusKey === "cancelled") return "This order was cancelled. Contact the shop if anything looks incorrect.";
    return "Delivery progress will appear here once the order moves forward.";
  };

  const renderDeliveryBox = (order) => {
    const delivery = getClientDelivery(order);
    const meta = getDeliveryMetaForOrder(order);
    const orderedEvents = [...(delivery.events || [])].sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0));
    const driverInfo = [delivery.driverName, delivery.driverPhone, delivery.vehicleNumber ? `Vehicle ${delivery.vehicleNumber}` : ""].filter(Boolean);
    const scheduledText = delivery.scheduledDate
      ? `${escapeHTML(fmtDate(delivery.scheduledDate))}${delivery.scheduledWindow ? ` • ${escapeHTML(delivery.scheduledWindow)}` : ""}`
      : delivery.preferredDate
      ? `Preferred ${escapeHTML(fmtDateOnly(delivery.preferredDate))} • ${escapeHTML(labelFromMap(DELIVERY_TIME_SLOT_META, delivery.preferredTimeSlot, "Call to confirm"))}`
      : "Will be confirmed by admin";
    const codeText = delivery.verificationCode ? escapeHTML(delivery.verificationCode) : "----";
    const verificationText = delivery.verificationCodeVerifiedAt
      ? `Code verified on ${escapeHTML(fmtDate(delivery.verificationCodeVerifiedAt))}`
      : "Share this code with the delivery boy only at handover if requested.";

    return `
      <div class="delivery-box">
        <div class="delivery-box-head">
          <div>
            <div class="badge">${escapeHTML(meta.label)}</div>
            <h4 style="margin:8px 0 6px">Own vehicle delivery tracking</h4>
            <p class="delivery-small-copy">${escapeHTML(meta.hint || "Delivery progress will appear here.")}</p>
          </div>
          <div class="delivery-status-chip">${escapeHTML(meta.label)}</div>
        </div>

        <div class="delivery-overview-grid">
          <div class="delivery-overview-card">
            <span>Service</span>
            <b>${escapeHTML(delivery.serviceLabel || "Owner vehicle delivery")}</b>
          </div>
          <div class="delivery-overview-card">
            <span>Schedule</span>
            <b>${scheduledText}</b>
          </div>
          <div class="delivery-overview-card">
            <span>Balance plan</span>
            <b>${escapeHTML(labelFromMap(BALANCE_COLLECTION_META, delivery.balanceCollectionMode, "To be confirmed"))}</b>
          </div>
          <div class="delivery-overview-card">
            <span>Unloading</span>
            <b>${escapeHTML(labelFromMap(UNLOADING_SUPPORT_META, delivery.unloadingSupport, "Will confirm by phone"))}</b>
          </div>
        </div>

        <div class="delivery-detail-grid">
          <div class="delivery-detail-card">
            <div><b>Site contact:</b> ${escapeHTML(delivery.siteContactName || order.customerName || "-")}</div>
            <div><b>Phone:</b> ${escapeHTML(delivery.siteContactPhone || order.phone || "-")}</div>
            <div><b>Call before delivery:</b> ${delivery.requiresCallBeforeDelivery === false ? "No" : "Yes"}</div>
            <div><b>Split delivery:</b> ${delivery.allowSplitDelivery === false ? "No - full order together" : "Yes - ready stock can move first"}</div>
          </div>
          <div class="delivery-detail-card">
            <div><b>Driver / vehicle:</b> ${driverInfo.length ? escapeHTML(driverInfo.join(" • ")) : "Will appear after scheduling"}</div>
            <div><b>Access notes:</b> ${escapeHTML(delivery.accessNotes || "No access note added yet")}</div>
            ${delivery.issueReason ? `<div><b>Issue logged:</b> ${escapeHTML(delivery.issueReason)}</div>` : ""}
            ${delivery.proofRecipientName ? `<div><b>Received by:</b> ${escapeHTML(delivery.proofRecipientName)}</div>` : ""}
          </div>
        </div>

        <div class="delivery-code-box">
          <div class="delivery-code-label">Delivery confirmation code</div>
          <div class="delivery-code-value">${codeText}</div>
          <div class="delivery-small-copy">${escapeHTML(verificationText)}</div>
        </div>

        ${delivery.publicNote ? `<div class="delivery-note"><b>Latest admin note:</b> ${escapeHTML(delivery.publicNote)}</div>` : ""}
        <div class="delivery-next-step"><b>Next step:</b> ${escapeHTML(getDeliveryNextStepText(order))}</div>
        ${delivery.proofImageUrl ? `<div class="delivery-proof-box"><div class="delivery-small-copy" style="margin-bottom:8px">Delivery proof image</div><a href="${escapeHTML(delivery.proofImageUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHTML(delivery.proofImageUrl)}" alt="Delivery proof"></a></div>` : ""}

        <div class="delivery-timeline">
          ${orderedEvents.map((event) => `
            <div class="delivery-timeline-item">
              <div class="delivery-timeline-dot"></div>
              <div>
                <div class="delivery-timeline-title">${escapeHTML(event?.title || DELIVERY_STATUS_META[event?.status]?.label || "Delivery update")}</div>
                <div class="delivery-small-copy">${escapeHTML(fmtDate(event?.createdAt))}${event?.actor ? ` • ${escapeHTML(event.actor)}` : ""}</div>
                ${event?.note ? `<div class="delivery-small-copy" style="margin-top:4px">${escapeHTML(event.note)}</div>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  };

  const renderProfile = (c) => {
    if (!c) return;
    if (elName) elName.textContent = c.fullName || "";
    if (elEmail) elEmail.textContent = c.email || "";
    if (elPhone) elPhone.textContent = c.phone || "";
    if (elAddr) elAddr.textContent = c.address || "";

    if (profileForm) {
      profileForm.fullName.value = c.fullName || "";
      profileForm.phone.value = c.phone || "";
      profileForm.address.value = c.address || "";
    }
  };

  const fmtDate = (d) => {
    try {
      return d ? new Date(d).toLocaleString() : "-";
    } catch {
      return d || "-";
    }
  };

  const getDeliveredAt = (order) => {
    if (order?.deliveredAt) return order.deliveredAt;
    if (["delivered", "partially_returned", "returned"].includes(String(order?.status || ""))) {
      return order?.updatedAt || order?.createdAt || null;
    }
    return null;
  };

  const daysBetweenNow = (dateValue) => {
    const date = dateValue ? new Date(dateValue) : null;
    if (!date || Number.isNaN(date.getTime())) return Infinity;
    return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
  };

  const countRequestedQtyForItem = (order, productId, { onlyCompleted = false } = {}) => {
    const target = String(productId || "");
    let total = 0;
    (order?.returnRequests || []).forEach((request) => {
      const status = String(request?.status || "");
      if (["rejected", "cancelled"].includes(status)) return;
      if (onlyCompleted && status !== "completed") return;
      (request.items || []).forEach((item) => {
        if (String(item?.productId || "") === target) {
          total += Number(item?.qty || 0);
        }
      });
    });
    return total;
  };

  const getRemainingQtyForItem = (order, item) => {
    const orderedQty = Number(item?.qty || 0);
    const activeQty = countRequestedQtyForItem(order, item?.productId);
    return Math.max(0, orderedQty - activeQty);
  };

  const isSelfServiceReturnOpen = (order) => {
    const deliveredAt = getDeliveredAt(order);
    if (!deliveredAt) return false;
    if (["cancelled", "pending", "confirmed"].includes(String(order?.status || ""))) return false;
    return daysBetweenNow(deliveredAt) <= 14;
  };

  const getReturnGuidance = (order) => {
    const deliveredAt = getDeliveredAt(order);
    if (!deliveredAt) return "Return requests open after delivery has been confirmed by the admin team.";
    const ageDays = daysBetweenNow(deliveredAt);
    if (ageDays <= 2) return "Visible damage, wrong items or missing parts should be requested within 48 hours.";
    if (ageDays <= 7) return "Defective or quality-related issues can still be submitted online within 7 days.";
    if (ageDays <= 14) return "Unused standard-stock items can still be submitted online within 14 days.";
    return "The self-service return window has closed. Please contact S.Gamage Constructions for warranty or manual support.";
  };

  const renderReturnPolicyBox = (order) => `
    <div class="return-policy-box" style="margin-top:14px">
      <div class="badge">Return & Warranty Policy</div>
      <ul class="return-policy-list">
        <li>Wrong item, missing parts or transit damage: report within 48 hours of delivery.</li>
        <li>Defective / quality issue: request within 7 days for review, replacement or refund decision.</li>
        <li>Unused standard-stock items: eligible within 14 days if sealed / unused and in resaleable condition.</li>
        <li>Cut-to-size, mixed, tinted, custom-made and special-order items are not accepted for change-of-mind returns unless the item is faulty or delivered incorrectly.</li>
      </ul>
      <div class="return-policy-foot">${escapeHTML(getReturnGuidance(order))}</div>
    </div>
  `;

  const renderReturnRequests = (order) => {
    const requests = Array.isArray(order?.returnRequests) ? order.returnRequests : [];
    if (!requests.length) {
      return `<div class="return-request-empty">No return requests submitted for this order yet.</div>`;
    }

    return requests
      .map((request) => {
        const itemsMarkup = (request.items || [])
          .map((item) => `
            <li>
              <b>${escapeHTML(item.name || "Item")}</b> • Qty ${Number(item.qty || 0)}
              <span style="color:var(--muted)">• ${escapeHTML(RETURN_REASON_META[item.reasonCode]?.label || item.reasonCode || "Reason")}</span>
            </li>
          `)
          .join("");

        const evidenceMarkup = Array.isArray(request.evidenceImages) && request.evidenceImages.length
          ? `
            <div class="return-evidence-grid">
              ${request.evidenceImages
                .map((url) => `
                  <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">
                    <img src="${escapeHTML(url)}" alt="Return evidence">
                  </a>
                `)
                .join("")}
            </div>
          `
          : "";

        const requestedResolutionLabel = RETURN_RESOLUTION_META[request.requestedResolution] || request.requestedResolution || "Replacement";
        const currentResolutionLabel = RETURN_RESOLUTION_META[request.resolutionType] || request.resolutionType || requestedResolutionLabel;
        const paymentStatusLabel = PAYMENT_STATUS_META[order.paymentStatus] || order.paymentStatus || "Payment pending";
        const showCurrentResolution = Boolean(
          request.resolutionType && (
            request.status !== "requested" ||
            request.resolutionType !== request.requestedResolution ||
            request.customerVisibleNote ||
            Number(request.refundAmountLKR || 0) > 0
          )
        );

        return `
          <div class="return-request-card">
            <div class="return-request-head">
              <div>
                <div class="badge">${escapeHTML(RETURN_STATUS_META[request.status] || request.status || "Requested")}</div>
                <h4 style="margin:8px 0 4px">${escapeHTML(request.requestNumber || "Return request")}</h4>
                <p class="return-small-copy">Submitted: ${escapeHTML(fmtDate(request.createdAt))}</p>
              </div>
              <div class="return-small-copy" style="text-align:right">
                <div><b>Requested:</b> ${escapeHTML(requestedResolutionLabel)}</div>
                ${showCurrentResolution ? `<div><b>Current resolution:</b> ${escapeHTML(currentResolutionLabel)}</div>` : ""}
                <div><b>Payment status:</b> ${escapeHTML(paymentStatusLabel)}</div>
                ${request.refundAmountLKR ? `<div><b>Refund:</b> LKR ${Number(request.refundAmountLKR || 0).toLocaleString()}</div>` : ""}
              </div>
            </div>

            <ul class="return-request-items">${itemsMarkup}</ul>
            ${request.description ? `<p class="return-small-copy"><b>Your note:</b> ${escapeHTML(request.description)}</p>` : ""}
            ${request.customerVisibleNote ? `<p class="return-admin-note"><b>Admin update:</b> ${escapeHTML(request.customerVisibleNote)}</p>` : ""}
            ${request.eligibleUntil ? `<p class="return-small-copy"><b>Policy deadline logged:</b> ${escapeHTML(fmtDate(request.eligibleUntil))}</p>` : ""}
            ${evidenceMarkup}
          </div>
        `;
      })
      .join("");
  };

  const renderOrderPaymentBox = (order) => {
    const proofImages = Array.isArray(order?.paymentProofImages) ? order.paymentProofImages.filter(Boolean) : [];
    const paymentLabel = order?.paymentMethodLabel || order?.paymentMethod || "Manual payment";

    const fullPaymentOrder = isFullPaymentOrder(order);

    return `
      <div class="order-payment-box">
        <div class="badge">${fullPaymentOrder ? "Full Payment" : "Advance Payment"}</div>
        <div class="order-payment-grid">
          <div class="order-payment-stat">
            <span>Order total</span>
            <b>LKR ${Number(order?.totalLKR || 0).toLocaleString()}</b>
          </div>
          <div class="order-payment-stat">
            <span>${fullPaymentOrder ? "Full payment paid / submitted" : "Advance paid / submitted"}</span>
            <b>LKR ${Number(order?.advanceDueLKR || 0).toLocaleString()}</b>
          </div>
          <div class="order-payment-stat">
            <span>${fullPaymentOrder ? "Balance remaining" : "Balance due later"}</span>
            <b>LKR ${Number(order?.balanceDueLKR || 0).toLocaleString()}</b>
          </div>
          <div class="order-payment-stat">
            <span>Payment status</span>
            <b>${escapeHTML(PAYMENT_STATUS_META[order?.paymentStatus] || order?.paymentStatus || "Payment pending")}</b>
          </div>
        </div>

        <div class="order-payment-meta">
          <div class="order-payment-meta-card">
            <div><b>Method:</b> ${escapeHTML(paymentLabel)}</div>
            <div><b>${fullPaymentOrder ? "Paid upfront" : "Advance rate"}:</b> ${fullPaymentOrder ? "Yes - before dispatch" : `${Number(order?.advancePercent || 0)}%`}</div>
            ${order?.paymentSubmittedAt ? `<div><b>Slip submitted:</b> ${escapeHTML(fmtDate(order.paymentSubmittedAt))}</div>` : ""}
            ${order?.paymentReference ? `<div><b>Reference:</b> ${escapeHTML(order.paymentReference)}</div>` : ""}
            ${order?.paymentNote ? `<div style="margin-top:8px"><b>Customer note:</b> ${escapeHTML(order.paymentNote)}</div>` : ""}
          </div>
          <div class="order-payment-meta-card">
            <div><b>Next step:</b> ${escapeHTML(getDeliveryNextStepText(order))}</div>
            ${order?.cryptoTxHash ? `<div style="margin-top:8px"><b>Crypto TX Hash</b><code>${escapeHTML(order.cryptoTxHash)}</code></div>` : ""}
          </div>
        </div>

        <div class="order-payment-copy" style="margin-top:10px">Uploaded payment proof</div>
        ${proofImages.length
          ? `<div class="order-payment-proof-grid">${proofImages.map((url) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHTML(url)}" alt="Payment proof"></a>`).join("")}</div>`
          : `<div class="order-payment-copy" style="margin-top:8px">No proof uploaded on this order.</div>`}
      </div>
    `;
  };

  const renderOrderItems = (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items
      .map((item) => {
        const remainingQty = getRemainingQtyForItem(order, item);
        const requestedQty = countRequestedQtyForItem(order, item?.productId);
        const imageUrl = item.imageUrl || "https://images.unsplash.com/photo-1581091215367-59ab6b9d8a1d?fm=jpg&q=80&w=400";
        const returnability = item.isReturnable === false
          ? (item.nonReturnableReason || "No change-of-mind returns for this item")
          : "Standard-stock returns accepted if policy conditions are met";

        return `
          <div class="order-item-card">
            <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(item.name || "Product")}">
            <div>
              <div class="order-item-title">${escapeHTML(item.name || "Product")}</div>
              <div class="order-item-meta">Qty ordered: ${Number(item.qty || 0)} • Unit price: LKR ${Number(item.priceLKR || 0).toLocaleString()}</div>
              ${(item.brand || "") ? `<div class="order-item-meta">Brand: ${escapeHTML(item.brand)}</div>` : ""}
              <div class="order-item-meta">${escapeHTML(returnability)}</div>
              ${requestedQty ? `<div class="order-item-meta">Already requested: ${requestedQty} • Remaining online qty: ${remainingQty}</div>` : `<div class="order-item-meta">Remaining online qty: ${remainingQty}</div>`}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderReturnForm = (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const canRequestNow = isSelfServiceReturnOpen(order);
    const hasRemaining = items.some((item) => getRemainingQtyForItem(order, item) > 0);

    if (!canRequestNow) {
      return `
        <div class="return-form-locked">
          ${escapeHTML(getReturnGuidance(order))}
        </div>
      `;
    }

    if (!hasRemaining) {
      return `
        <div class="return-form-locked">
          All item quantities from this order are already included in an active return request.
        </div>
      `;
    }

    const itemRows = items
      .map((item) => {
        const productId = String(item?.productId || "");
        const remainingQty = getRemainingQtyForItem(order, item);
        const disabled = remainingQty <= 0;
        return `
          <div class="return-select-row ${disabled ? "disabled" : ""}">
            <label class="return-select-check">
              <input type="checkbox" name="returnProduct" value="${escapeHTML(productId)}" ${disabled ? "disabled" : ""}>
              <span>
                <b>${escapeHTML(item.name || "Item")}</b><br>
                <small>Available for request: ${remainingQty}</small>
              </span>
            </label>
            <div>
              <label>Qty</label>
              <input name="qty-${escapeHTML(productId)}" type="number" min="1" max="${remainingQty}" value="1" ${disabled ? "disabled" : ""}>
            </div>
            <div>
              <label>Reason</label>
              <select name="reason-${escapeHTML(productId)}" ${disabled ? "disabled" : ""}>
                <option value="damaged_on_arrival">Damaged on arrival</option>
                <option value="wrong_item_or_missing_parts">Wrong item / missing parts</option>
                <option value="defective_or_quality_issue">Defective / quality issue</option>
                <option value="unused_unopened">Unused / unopened standard item</option>
              </select>
            </div>
            <div>
              <label>Condition</label>
              <select name="condition-${escapeHTML(productId)}" ${disabled ? "disabled" : ""}>
                <option value="sealed">Sealed</option>
                <option value="unused">Unused</option>
                <option value="opened" selected>Opened</option>
                <option value="installed">Installed</option>
              </select>
            </div>
          </div>
        `;
      })
      .join("");

    const phone = getCustomerProfile()?.phone || "";

    return `
      <form class="return-form" data-order-id="${escapeHTML(order._id)}">
        <div class="return-select-grid">${itemRows}</div>

        <div class="return-form-grid">
          <div>
            <label>Preferred resolution</label>
            <select name="requestedResolution">
              <option value="replacement">Replacement</option>
              <option value="refund">Refund</option>
              <option value="exchange">Exchange</option>
              <option value="store_credit">Store credit</option>
              <option value="repair">Repair / inspection</option>
            </select>
          </div>
          <div>
            <label>Return handover</label>
            <select name="pickupPreference">
              <option value="drop_off">Bring to shop / warehouse</option>
              <option value="pickup">Request pickup for bulky item</option>
            </select>
          </div>
          <div>
            <label>Contact phone</label>
            <input name="contactPhone" type="text" value="${escapeHTML(phone)}" placeholder="Phone number for return coordination">
          </div>
          <div>
            <label>Evidence photos (up to 4)</label>
            <input name="evidence" type="file" accept="image/png,image/jpeg,image/webp" multiple>
          </div>
          <div>
            <label>Bank name (optional for refund)</label>
            <input name="bankName" type="text" placeholder="Optional">
          </div>
          <div>
            <label>Bank branch (optional)</label>
            <input name="bankBranch" type="text" placeholder="Optional">
          </div>
          <div>
            <label>Account name (optional)</label>
            <input name="bankAccountName" type="text" placeholder="Optional">
          </div>
          <div>
            <label>Account number (optional)</label>
            <input name="bankAccountNumber" type="text" placeholder="Optional">
          </div>
        </div>

        <label style="display:block;margin-top:10px">Describe the issue</label>
        <textarea name="description" rows="4" placeholder="Explain what went wrong, when you noticed the issue, and whether the item was installed or used."></textarea>

        <div class="return-small-copy" style="margin-top:10px">Wrong items / missing parts should be submitted within 48 hours. Defective items within 7 days. Unused standard-stock items within 14 days.</div>
        <div class="status" data-return-status style="margin-top:10px"></div>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" type="submit">Submit Return Request</button>
        </div>
      </form>
    `;
  };

  const bindReturnActions = (orders = []) => {
    if (!ordersList) return;

    ordersList.querySelectorAll("[data-return-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.getElementById(`return-form-wrap-${button.dataset.returnToggle}`);
        if (!target) return;
        target.style.display = target.style.display === "none" ? "block" : "none";
      });
    });

    ordersList.querySelectorAll(".return-form").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const orderId = form.dataset.orderId;
        const statusEl = form.querySelector("[data-return-status]");
        const selectedProducts = [...form.querySelectorAll('input[name="returnProduct"]:checked')].map((input) => input.value);

        if (!selectedProducts.length) {
          if (statusEl) {
            statusEl.textContent = "Please select at least one item.";
            statusEl.className = "status error";
          }
          return;
        }

        const itemPayload = selectedProducts.map((productId) => ({
          productId,
          qty: Number(form.querySelector(`[name="qty-${productId}"]`)?.value || 1),
          reasonCode: String(form.querySelector(`[name="reason-${productId}"]`)?.value || "damaged_on_arrival"),
          condition: String(form.querySelector(`[name="condition-${productId}"]`)?.value || "opened")
        }));

        try {
          if (statusEl) {
            statusEl.textContent = "Uploading evidence and submitting return request...";
            statusEl.className = "status";
          }

          const evidenceInput = form.querySelector('[name="evidence"]');
          const files = evidenceInput?.files ? Array.from(evidenceInput.files).slice(0, 4) : [];
          const evidenceImages = files.length ? await uploadReturnEvidence(files) : [];

          await fetchJSONCustomer(`${API_BASE}/orders/${orderId}/returns`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: itemPayload,
              requestedResolution: form.requestedResolution.value,
              pickupPreference: form.pickupPreference.value,
              contactPhone: form.contactPhone.value.trim(),
              description: form.description.value.trim(),
              evidenceImages,
              bankName: form.bankName.value.trim(),
              bankBranch: form.bankBranch.value.trim(),
              bankAccountName: form.bankAccountName.value.trim(),
              bankAccountNumber: form.bankAccountNumber.value.trim()
            })
          });

          if (statusEl) {
            statusEl.textContent = "✅ Return request submitted. Admin will review and contact you.";
            statusEl.className = "status success";
          }

          await loadAccountData();
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = "❌ " + (err.message || err);
            statusEl.className = "status error";
          }
        }
      });
    });
  };

  const renderOrders = (items) => {
    if (!ordersList) return;
    if (!items.length) {
      ordersList.innerHTML = `
        <div class="return-policy-box">
          <div class="badge">No orders yet</div>
          <p class="return-small-copy" style="margin-top:10px">Place your first hardware order from the shop. Once an order is delivered, this page will let the customer submit damage, defect and return requests online.</p>
        </div>
      `;
      return;
    }

    ordersList.innerHTML = items
      .map((order) => {
        const deliveredAt = getDeliveredAt(order);
        const selfServiceOpen = isSelfServiceReturnOpen(order);
        const orderLabel = order.orderNumber || order._id;
        const canToggle = selfServiceOpen && (order.items || []).some((item) => getRemainingQtyForItem(order, item) > 0);
        const deliveryMeta = getDeliveryMetaForOrder(order);
        const delivery = getClientDelivery(order);
        const scheduleHint = delivery.scheduledDate
          ? `Scheduled ${fmtDate(delivery.scheduledDate)}${delivery.scheduledWindow ? ` • ${delivery.scheduledWindow}` : ""}`
          : delivery.preferredDate
          ? `Preferred ${fmtDateOnly(delivery.preferredDate)} • ${labelFromMap(DELIVERY_TIME_SLOT_META, delivery.preferredTimeSlot, "Call to confirm")}`
          : "Schedule will be confirmed by admin";

        return `
          <div class="panel order-card" style="margin-top:10px">
            <div class="order-card-head">
              <div>
                <div class="badge">${escapeHTML(order.status || "pending")} • ${escapeHTML(deliveryMeta.label)} • ${escapeHTML(fmtDate(order.createdAt))}</div>
                <h3 style="margin:8px 0 4px">Order ${escapeHTML(orderLabel)}</h3>
                <p class="return-small-copy"><b>Total:</b> LKR ${Number(order.totalLKR || 0).toLocaleString()} • <b>Items:</b> ${(order.items || []).length} • <b>Payment:</b> ${escapeHTML(PAYMENT_STATUS_META[order.paymentStatus] || order.paymentStatus || "Payment pending")}</p>
                <p class="return-small-copy">${deliveredAt ? `Delivered on ${escapeHTML(fmtDate(deliveredAt))}` : escapeHTML(scheduleHint)}</p>
              </div>
              <div>
                <button class="btn ghost" type="button" data-return-toggle="${escapeHTML(order._id)}" ${canToggle ? "" : "disabled"}>${canToggle ? "Request Return" : "Return Form Locked"}</button>
              </div>
            </div>

            ${renderOrderPaymentBox(order)}
            ${renderDeliveryBox(order)}

            <div class="order-items-grid">
              ${renderOrderItems(order)}
            </div>

            ${renderReturnPolicyBox(order)}

            <div id="return-form-wrap-${escapeHTML(order._id)}" class="return-form-wrap" style="display:none">
              <div class="badge">Submit a return request</div>
              ${renderReturnForm(order)}
            </div>

            <div class="return-requests-wrap">
              <div class="badge">Return Requests</div>
              <div style="margin-top:10px">${renderReturnRequests(order)}</div>
            </div>
          </div>
        `;
      })
      .join("");

    bindReturnActions(items);
  };

  const renderInquiries = (items) => {
    if (!inquiriesList) return;
    if (!items.length) {
      inquiriesList.innerHTML = `<p style="color:var(--muted)">No inquiries yet.</p>`;
      return;
    }

    const msgsFor = (inq) => {
      const list = Array.isArray(inq.messages) ? inq.messages : [];
      if (list.length) return list;
      const first = (inq.message || "").trim();
      return first
        ? [{ sender: "customer", text: first, createdAt: inq.createdAt }]
        : [];
    };

    const renderMsgs = (inq) => {
      const msgs = msgsFor(inq);
      if (!msgs.length) return `<div class="chat-empty">No messages yet.</div>`;
      return msgs
        .map((m) => {
          const role = m.sender === "admin" ? "admin" : "customer";
          const who = role === "admin" ? "Admin" : "You";
          const when = m.createdAt ? fmtDate(m.createdAt) : "";
          return `
            <div class="chat-row ${role}">
              <div class="chat-bubble ${role}">
                <div class="chat-meta">${escapeHTML(who)} ${when ? "• " + escapeHTML(when) : ""}</div>
                <div class="chat-text">${escapeHTML(m.text || "")}</div>
              </div>
            </div>
          `;
        })
        .join("");
    };

    inquiriesList.innerHTML = items
      .map((i) => {
        return `
        <div class="panel" style="margin-top:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div class="badge">${escapeHTML(i.status || "new")} • ${fmtDate(i.createdAt)}</div>
            <button class="btn secondary" type="button" data-chat-toggle="${i._id}">Conversation</button>
          </div>
          <p style="margin:6px 0 0;color:var(--muted)"><b>Service:</b> ${escapeHTML(i.service || "-")}</p>
          ${i.location ? `<p style="margin:6px 0 0;color:var(--muted)"><b>Location:</b> ${escapeHTML(i.location)}</p>` : ""}
          <p style="margin:6px 0 0;color:var(--muted)"><b>Initial Message:</b> ${escapeHTML(i.message || "")}</p>

          <div class="chat-thread" id="chat-${i._id}" style="display:none">
            <div class="chat-messages" id="chat-msgs-${i._id}">${renderMsgs(i)}</div>
            <div class="chat-send">
              <textarea class="chat-input" id="chat-input-${i._id}" placeholder="Type a follow-up message..."></textarea>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <button class="btn" type="button" data-chat-send="${i._id}">Send</button>
                <div class="status" id="chat-status-${i._id}" style="margin:0;flex:1;min-width:220px"></div>
              </div>
            </div>
            <small style="color:var(--muted);display:block;margin-top:10px">Tip: You can continue this conversation here. Admin will reply from their dashboard.</small>
          </div>
        </div>
      `;
      })
      .join("");

    inquiriesList.querySelectorAll("[data-chat-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-chat-toggle");
        const box = document.getElementById(`chat-${id}`);
        if (!box) return;
        box.style.display = box.style.display === "none" ? "block" : "none";
      });
    });

    inquiriesList.querySelectorAll("[data-chat-send]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-chat-send");
        const input = document.getElementById(`chat-input-${id}`);
        const status = document.getElementById(`chat-status-${id}`);
        if (!input) return;
        const text = (input.value || "").trim();
        if (!text) {
          if (status) {
            status.textContent = "Please type a message.";
            status.className = "status error";
          }
          return;
        }
        if (status) {
          status.textContent = "Sending...";
          status.className = "status";
        }

        try {
          await fetchJSONCustomer(`${API_BASE}/inquiries/${id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
          });
          input.value = "";
          if (status) {
            status.textContent = "✅ Sent";
            status.className = "status success";
          }

          const fresh = await fetchJSONCustomer(`${API_BASE}/customers/me/inquiries`);
          renderInquiries(fresh || []);
        } catch (err) {
          if (status) {
            status.textContent = "❌ " + (err.message || err);
            status.className = "status error";
          }
        }
      });
    });
  };

  const renderReviews = (items) => {
    if (!reviewsList) return;
    if (!items.length) {
      reviewsList.innerHTML = `<p style="color:var(--muted)">No reviews yet.</p>`;
      return;
    }
    reviewsList.innerHTML = items
      .map(
        (r) => `
      <div class="panel" style="margin-top:10px">
        <div class="badge">${stars(r.rating)} • ${r.rating}/5 • ${fmtDate(r.createdAt)}</div>
        <p style="margin:6px 0 0;color:var(--muted)"><b>Project:</b> ${escapeHTML(r.projectId?.title || "-")}</p>
        <p style="margin:6px 0 0;color:var(--muted)">${escapeHTML(r.feedback || "")}</p>
      </div>
    `
      )
      .join("");
  };

  const renderApps = (items) => {
    if (!appsList) return;
    if (!items.length) {
      appsList.innerHTML = `<p style="color:var(--muted)">No job applications yet.</p>`;
      return;
    }
    appsList.innerHTML = items
      .map(
        (a) => `
      <div class="panel" style="margin-top:10px">
        <div class="badge">${escapeHTML(a.status || "new")} • ${fmtDate(a.createdAt)}</div>
        <p style="margin:6px 0 0;color:var(--muted)"><b>Job:</b> ${escapeHTML(a.jobId?.title || "-")}</p>
        <small style="color:var(--muted)">Application ID: ${a._id}</small>
      </div>
    `
      )
      .join("");
  };

  const loadAccountData = async () => {
    const c = await fetchCustomerMe();
    renderProfile(c || getCustomerProfile());

    try {
      const [orders, inquiries, reviews, apps] = await Promise.all([
        fetchJSONCustomer(`${API_BASE}/customers/me/orders`),
        fetchJSONCustomer(`${API_BASE}/customers/me/inquiries`),
        fetchJSONCustomer(`${API_BASE}/customers/me/reviews`),
        fetchJSONCustomer(`${API_BASE}/customers/me/applications`)
      ]);
      renderOrders(orders || []);
      renderInquiries(inquiries || []);
      renderReviews(reviews || []);
      renderApps(apps || []);
    } catch (err) {
      toast(err.message || err);
    }
  };

  loadAccountData();

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (profileStatus) {
        profileStatus.textContent = "Saving...";
        profileStatus.className = "status";
      }

      const payload = {
        fullName: profileForm.fullName.value.trim(),
        phone: profileForm.phone.value.trim(),
        address: profileForm.address.value.trim()
      };

      try {
        const updated = await fetchJSONCustomer(`${API_BASE}/customers/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (updated?.customer) {
          localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(updated.customer));
          renderProfile(updated.customer);
          initCustomerNav();
        }

        if (profileStatus) {
          profileStatus.textContent = "✅ Saved";
          profileStatus.className = "status success";
        }
      } catch (err) {
        if (profileStatus) {
          profileStatus.textContent = "❌ " + err.message;
          profileStatus.className = "status error";
        }
      }
    });
  }
}

