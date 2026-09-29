const $ = (selector) => document.querySelector(selector);

const attachmentsGrid = $("#attachmentsGrid");
const calloutsGrid = $("#calloutsGrid");
const searchInput = $("#searchInput");
const typeFilter = $("#typeFilter");
const resultCount = $("#resultCount");
const modal = $("#adminModal");
const toast = $("#toast");

let attachments = [];
let callouts = [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  let data = {};
  try { data = await response.json(); } catch {}

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function attachmentCard(item) {
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.weapon)}">`
    : `<span>${escapeHtml(item.weapon.toUpperCase())}</span>`;

  return `
    <article class="card">
      <div class="thumb">${image}</div>
      <div class="card-body">
        <div class="card-top">
          <div>
            <small class="muted">${escapeHtml(item.weapon)}</small>
            <h3>${escapeHtml(item.attachment)}</h3>
          </div>
          <span class="badge">${escapeHtml(item.type)}</span>
        </div>
        <p>${escapeHtml(item.description || "No description available.")}</p>
        ${item.featured ? '<span class="badge featured">★ Featured</span>' : ''}
      </div>
    </article>
  `;
}

function renderAttachments() {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;

  const filtered = attachments.filter(a => {
    const matchesText = !query || [a.weapon, a.attachment, a.type, a.description]
      .some(v => String(v || "").toLowerCase().includes(query));
    return matchesText && (!type || a.type === type);
  });

  resultCount.textContent = filtered.length;

  attachmentsGrid.innerHTML = filtered.length
    ? filtered.map(attachmentCard).join("")
    : `<div class="empty">No attachments found. Try another search.</div>`;
}

function renderCallouts() {
  calloutsGrid.innerHTML = callouts.length
    ? callouts.map(c => `
      <article class="callout">
        <div class="thumb">
          ${c.image
            ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)}">`
            : `<span>MAP CALLOUT</span>`}
        </div>
        <div class="body">
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.description || "")}</p>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No featured callouts yet.</div>`;
}

async function loadAttachments() {
  try {
    attachments = await api("/api/attachments");
    renderAttachments();
  } catch (err) {
    attachmentsGrid.innerHTML = `<div class="empty">Could not load attachments: ${escapeHtml(err.message)}</div>`;
    resultCount.textContent = "0";
  }
}

async function loadCallouts() {
  try {
    callouts = await api("/api/callouts");
    renderCallouts();
  } catch (err) {
    calloutsGrid.innerHTML = `<div class="empty">Could not load callouts: ${escapeHtml(err.message)}</div>`;
  }
}

async function checkAdmin() {
  try {
    const me = await api("/api/admin/me");
    setAdminView(me.admin);
    if (me.admin) refreshAdminLists();
  } catch {
    setAdminView(false);
  }
}

function setAdminView(isAdmin) {
  $("#loginView").classList.toggle("hidden", isAdmin);
  $("#dashboardView").classList.toggle("hidden", !isAdmin);
}

function openModal() {
  modal.classList.remove("hidden");
  checkAdmin();
}

function closeModal() {
  modal.classList.add("hidden");
}

async function refreshAdminLists() {
  const [a, c] = await Promise.all([
    api("/api/attachments"),
    api("/api/callouts")
  ]);

  $("#adminAttachments").innerHTML = a.map(item => `
    <div class="admin-item">
      <div><strong>${escapeHtml(item.weapon)}</strong> — ${escapeHtml(item.attachment)}
        <br><small>${escapeHtml(item.type)}</small></div>
      <button class="delete-btn" data-delete-attachment="${item.id}">Remove</button>
    </div>
  `).join("");

  $("#adminCallouts").innerHTML = c.map(item => `
    <div class="admin-item">
      <div><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.description)}</small></div>
      <button class="delete-btn" data-delete-callout="${item.id}">Remove</button>
    </div>
  `).join("");
}

searchInput.addEventListener("input", renderAttachments);
typeFilter.addEventListener("change", renderAttachments);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === "Escape") closeModal();
});

$("#adminBtn").addEventListener("click", openModal);
document.querySelector("[data-close]").addEventListener("click", closeModal);

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: $("#adminPassword").value })
    });
    $("#adminPassword").value = "";
    setAdminView(true);
    await refreshAdminLists();
    showToast("Admin login successful.");
  } catch (err) {
    showToast(err.message);
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  setAdminView(false);
  showToast("Logged out.");
});

$("#attachmentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.featured = data.featured === "on";

  try {
    await api("/api/attachments", {
      method: "POST",
      body: JSON.stringify(data)
    });
    e.target.reset();
    await loadAttachments();
    await refreshAdminLists();
    showToast("Attachment added.");
  } catch (err) {
    showToast(err.message);
  }
});

$("#calloutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.featured = data.featured === "on";

  try {
    await api("/api/callouts", {
      method: "POST",
      body: JSON.stringify(data)
    });
    e.target.reset();
    e.target.featured.checked = true;
    await loadCallouts();
    await refreshAdminLists();
    showToast("Callout added.");
  } catch (err) {
    showToast(err.message);
  }
});

document.addEventListener("click", async (e) => {
  const attachmentId = e.target.dataset.deleteAttachment;
  const calloutId = e.target.dataset.deleteCallout;

  try {
    if (attachmentId) {
      await api(`/api/attachments/${attachmentId}`, { method: "DELETE" });
      await loadAttachments();
      await refreshAdminLists();
      showToast("Attachment removed.");
    }

    if (calloutId) {
      await api(`/api/callouts/${calloutId}`, { method: "DELETE" });
      await loadCallouts();
      await refreshAdminLists();
      showToast("Callout removed.");
    }
  } catch (err) {
    showToast(err.message);
  }
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.add("hidden"));
    tab.classList.add("active");
    $(`#${tab.dataset.tab}`).classList.remove("hidden");
  });
});

loadAttachments();
loadCallouts();
checkAdmin();
