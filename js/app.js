// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SMS_API_URL = "https://surgery-stick-assistance-what.trycloudflare.com/send_sms";

const TEMPLATES = [
  {
    id: 1,
    name: "Template 1: Verification Greeting",
    templateId: "9876543210987654321",
    peid: "1234567890123456789",
    sender: "ABCDEF",
    message: "Alert: Your transaction was processed successfully at the messaging gateway cloud."
  },
  {
    id: 2,
    name: "Template 2: Payment Gateway Alert",
    templateId: "1234567890123456789",
    peid: "1234567890123456789",
    sender: "ABCDEF",
    message: "Dear Customer, your payment has been received. Thank you for your business."
  }
];

// ─── GLOBALS ──────────────────────────────────────────────────────────────────
let campaignId = null;
let allLeads   = [];
let selectedLead = null;

// ─── SAFE INIT — wait for SDK to be ready ─────────────────────────────────────
function startApp() {
  ZOHO.embeddedApp.on("PageLoad", function(data) {
    console.log("[SMS Widget] PageLoad:", JSON.stringify(data));

    campaignId = data.EntityId || data.entityId || null;
    const campName = data.Name || data.name || ("Campaign ID: " + campaignId) || "Campaign";
    document.getElementById("campaignName").textContent = campName;

    populateTemplates();

    if (campaignId) {
      fetchLeads(campaignId);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const idFromUrl = urlParams.get("EntityId") || urlParams.get("recordId");
      if (idFromUrl) {
        campaignId = idFromUrl;
        fetchLeads(campaignId);
      } else {
        showNoLeads("Campaign ID detect nahi hua. Widget ko Campaign record se open karein.");
      }
    }
  });

  ZOHO.embeddedApp.init();
}

// Wait for ZOHO SDK to load
if (typeof ZOHO !== "undefined") {
  startApp();
} else {
  window.addEventListener("load", function() {
    if (typeof ZOHO !== "undefined") {
      startApp();
    } else {
      // SDK still not loaded — retry
      var attempts = 0;
      var interval = setInterval(function() {
        attempts++;
        if (typeof ZOHO !== "undefined") {
          clearInterval(interval);
          startApp();
        } else if (attempts > 20) {
          clearInterval(interval);
          showNoLeads("Zoho SDK load nahi hua. CRM ke andar widget open karein.");
        }
      }, 500);
    }
  });
}

// ─── FETCH LEADS ──────────────────────────────────────────────────────────────
function fetchLeads(campId) {
  document.getElementById("leadsContainer").innerHTML =
    '<div class="loading-state"><div class="spinner-blue"></div><span>Fetching leads...</span></div>';

  ZOHO.CRM.API.getRelatedRecords({
    Entity: "Campaigns",
    RecordID: campId,
    RelatedList: "Leads",
    page: 1,
    per_page: 50
  })
  .then(function(data) {
    console.log("[SMS Widget] Leads response:", JSON.stringify(data));
    if (data && data.data && data.data.length > 0) {
      allLeads = data.data;
      renderLeads(allLeads);
    } else {
      fetchContacts(campId);
    }
  })
  .catch(function(err) {
    console.error("[SMS Widget] Leads error:", err);
    fetchContacts(campId);
  });
}

function fetchContacts(campId) {
  ZOHO.CRM.API.getRelatedRecords({
    Entity: "Campaigns",
    RecordID: campId,
    RelatedList: "Contacts",
    page: 1,
    per_page: 50
  })
  .then(function(data) {
    if (data && data.data && data.data.length > 0) {
      allLeads = data.data;
      renderLeads(allLeads);
    } else {
      showNoLeads("Is campaign me koi lead/contact nahi hai.");
    }
  })
  .catch(function() {
    showNoLeads("Leads load karne me error aaya.");
  });
}

// ─── RENDER LEADS ─────────────────────────────────────────────────────────────
function renderLeads(leads) {
  const container = document.getElementById("leadsContainer");
  container.innerHTML = "";

  if (!leads || leads.length === 0) {
    showNoLeads();
    return;
  }

  leads.forEach(function(lead) {
    const firstName = lead.First_Name || "";
    const lastName  = lead.Last_Name  || "";
    const name      = lead.Full_Name  || (firstName + " " + lastName).trim() || lead.Name || "Unknown";
    const mobile    = lead.Mobile || lead.Phone || "";
    const email     = lead.Email  || "";

    const card = document.createElement("div");
    card.className = "lead-card" + (mobile ? "" : " disabled");

    card.innerHTML =
      '<div class="lead-avatar">' + name.charAt(0).toUpperCase() + '</div>' +
      '<div class="lead-info">' +
        '<div class="lead-name">' + name + '</div>' +
        '<div class="lead-meta">' +
          (mobile
            ? '<span class="lead-mobile">📱 ' + mobile + '</span>'
            : '<span class="lead-no-mobile">No mobile</span>') +
          (email ? ' &nbsp;·&nbsp; ' + email : '') +
        '</div>' +
      '</div>' +
      '<div class="lead-arrow">→</div>';

    if (mobile) {
      card.onclick = function() { selectLead(lead, name, mobile); };
    }

    container.appendChild(card);
  });
}

// ─── FILTER ───────────────────────────────────────────────────────────────────
function filterLeads() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  if (!q) { renderLeads(allLeads); return; }
  const filtered = allLeads.filter(function(l) {
    const name   = (l.Full_Name || l.First_Name || l.Name || "").toLowerCase();
    const mobile = (l.Mobile || l.Phone || "").toLowerCase();
    return name.includes(q) || mobile.includes(q);
  });
  renderLeads(filtered);
}

// ─── SELECT LEAD ──────────────────────────────────────────────────────────────
function selectLead(lead, name, mobile) {
  selectedLead = lead;
  document.getElementById("selectedLeadName").textContent = name;
  document.getElementById("mobileInput").value = mobile.replace(/\D/g, "");

  const badge = document.getElementById("mobileBadge");
  badge.textContent = "✓ Auto";
  badge.style.background = "#d1fae5";
  badge.style.color = "#065f46";

  document.getElementById("step1").classList.add("hidden");
  document.getElementById("step2").classList.remove("hidden");

  hideResult(); hideError();
  document.getElementById("templateSelect").value = "";
  document.getElementById("messageArea").value = "";
  document.getElementById("charCount").textContent = "0";
  document.getElementById("templatePreview").classList.add("hidden");
}

function goBack() {
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step1").classList.remove("hidden");
  selectedLead = null;
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
function populateTemplates() {
  const select = document.getElementById("templateSelect");
  // Clear existing options except first
  while (select.options.length > 1) select.remove(1);
  
  TEMPLATES.forEach(function(t) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
}

function onTemplateChange() {
  const id = document.getElementById("templateSelect").value;
  if (!id) {
    document.getElementById("templatePreview").classList.add("hidden");
    document.getElementById("messageArea").value = "";
    document.getElementById("charCount").textContent = "0";
    return;
  }
  const t = TEMPLATES.find(function(x) { return x.id == id; });
  if (!t) return;

  document.getElementById("senderInput").value    = t.sender     || "";
  document.getElementById("peidInput").value      = t.peid       || "";
  document.getElementById("templateIdInput").value = t.templateId || "";
  document.getElementById("messageArea").value    = t.message    || "";
  document.getElementById("charCount").textContent = (t.message || "").length;

  const preview = document.getElementById("templatePreview");
  preview.textContent = t.message;
  preview.classList.remove("hidden");

  hideResult(); hideError();
}

function updateCharCount() {
  document.getElementById("charCount").textContent =
    document.getElementById("messageArea").value.length;
}

// ─── SEND SMS ─────────────────────────────────────────────────────────────────
async function sendSMS() {
  hideResult(); hideError();

  const mobile     = document.getElementById("mobileInput").value.trim();
  const sender     = document.getElementById("senderInput").value.trim();
  const peid       = document.getElementById("peidInput").value.trim();
  const templateId = document.getElementById("templateIdInput").value.trim();
  const message    = document.getElementById("messageArea").value.trim();

  if (!mobile || mobile.length < 10) { showError("Valid 10-digit mobile required."); return; }
  if (!sender || sender.length !== 6) { showError("Sender ID must be exactly 6 characters."); return; }
  if (!peid)       { showError("PEID required."); return; }
  if (!templateId) { showError("Template ID required."); return; }
  if (!message)    { showError("Message empty nahi hona chahiye."); return; }

  setBtnLoading(true);

  try {
    const payload = { mobile, sender, message, peid, template_id: templateId };
    console.log("[SMS Widget] Sending:", JSON.stringify(payload));

    const response = await fetch(SMS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("[SMS Widget] Response:", JSON.stringify(result));

    if (response.ok) {
      const msgId =
        result.msg_id || result.message_id || result.msgId || result.id ||
        Object.values(result).find(function(v) {
          return typeof v === "string" && v.length > 4;
        }) || "N/A";

      showResult(msgId);

      if (selectedLead && selectedLead.id) {
        ZOHO.CRM.API.addNote({
          Entity: "Leads",
          RecordID: selectedLead.id,
          Note_Title: "SMS Sent via Campaign",
          Note_Content: "📱 Mobile: " + mobile + "\n🆔 Msg ID: " + msgId + "\n📝 Message: " + message
        }).catch(function(e) { console.warn("Note error:", e); });
      }
    } else {
      showError(result.error || result.message || "API error: HTTP " + response.status);
    }
  } catch(err) {
    console.error("[SMS Widget] Error:", err);
    showError("Network error — SMS server tak nahi pahuncha.");
  } finally {
    setBtnLoading(false);
  }
}

function sendAnother() { goBack(); }

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function showResult(msgId) {
  document.getElementById("msgIdValue").textContent = msgId;
  document.getElementById("resultBox").classList.remove("hidden");
}
function hideResult() { document.getElementById("resultBox").classList.add("hidden"); }
function showError(msg) {
  document.getElementById("errorMsg").textContent = msg;
  document.getElementById("errorBox").classList.remove("hidden");
}
function hideError() { document.getElementById("errorBox").classList.add("hidden"); }
function showNoLeads(msg) {
  document.getElementById("leadsContainer").innerHTML = "";
  const el = document.getElementById("noLeads");
  if (msg) el.querySelector("p").textContent = msg;
  el.classList.remove("hidden");
}
function setBtnLoading(on) {
  document.getElementById("sendBtn").disabled = on;
  document.getElementById("sendBtnText").textContent = on ? "Sending..." : "Send SMS";
  document.getElementById("sendBtnSpinner").classList.toggle("hidden", !on);
}
function copyMsgId() {
  navigator.clipboard.writeText(document.getElementById("msgIdValue").textContent)
    .then(function() {
      const btn = document.querySelector(".copy-btn");
      btn.textContent = "Copied!";
      setTimeout(function() { btn.textContent = "Copy"; }, 2000);
    });
}
