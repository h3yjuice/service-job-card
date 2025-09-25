/* =========================================================
   Service Job Card — Vanilla JS + LocalStorage
   Repo/Folder: service-job-card
========================================================= */
const LS_KEYS = {
    JOBS: "sjc.jobs",
    SETTINGS: "sjc.settings",
    DRAFT: "sjc.draft",
};

// ---------- Simple Store ----------
const readStore = (k, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(k)) ?? fallback;
    } catch {
        return fallback;
    }
};
const writeStore = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ---------- State ----------
let jobs = readStore(LS_KEYS.JOBS, []);
let settings = readStore(LS_KEYS.SETTINGS, {
    name: "Service Job Card",
    address: "",
    phone: "",
});
const draft = readStore(LS_KEYS.DRAFT, {});

// ---------- Elements ----------
const drawer = document.getElementById("drawer");
const jobForm = document.getElementById("jobForm");
const btnNew = document.getElementById("btnNew");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const searchInput = document.getElementById("search");
const btnExport = document.getElementById("btnExport");
const importFile = document.getElementById("importFile");
const btnReset = document.getElementById("btnReset");
const shopTitle = document.getElementById("shopTitle");
const shopSub = document.getElementById("shopSub");

// Columns
const colNew = document.getElementById("col-new");
const colIn = document.getElementById("col-in_progress");
const colReady = document.getElementById("col-ready");
const colPicked = document.getElementById("col-picked_up");
const cardTpl = document.getElementById("jobCardTpl");

// Job Modal
const jobModal = document.getElementById("jobModal");
const jobDetailForm = document.getElementById("jobDetailForm");
const closeJobModal = document.getElementById("closeJobModal");
const detailId = document.getElementById("detailId");
const detailStatus = document.getElementById("detailStatus");
const detailCreated = document.getElementById("detailCreated");
const btnToNew = document.getElementById("btnToNew");
const btnToIn = document.getElementById("btnToIn");
const btnToReady = document.getElementById("btnToReady");
const btnPickup = document.getElementById("btnPickup");
const btnPrintTicket = document.getElementById("btnPrintTicket");
const btnDeleteJob = document.getElementById("btnDeleteJob");

// Settings Modal
const settingsModal = document.getElementById("settingsModal");
const settingsForm = document.getElementById("settingsForm");
const btnSettings = document.getElementById("btnSettings");
const closeSettings = document.getElementById("closeSettings");
const btnSettingsClear = document.getElementById("btnSettingsClear");

// ---------- Utils ----------
const $ = (sel, root = document) => root.querySelector(sel);
const fmtDateTime = (iso) => {
    if (!iso) return "";
    const dt = new Date(iso);
    const opts = {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    };
    return dt.toLocaleString(undefined, opts);
};
const todayKey = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
};
const nextId = () => {
    const key = todayKey();
    const countToday = jobs.filter((j) => j.id.startsWith(key)).length + 1;
    return `${key}-${String(countToday).padStart(3, "0")}`;
};
const currency = (n) => (isFinite(n) ? `₹${Number(n).toFixed(2)}` : "₹0.00");

// ---- Calculations ----
const calcTotal = (estimate, taxPercent) => {
    const est = Number(estimate || 0);
    const taxP = Number(taxPercent || 0);
    return est + (est * taxP) / 100;
};
const calcBalance = (estimate, taxPercent, advance) => {
    const adv = Number(advance || 0);
    const total = calcTotal(estimate, taxPercent);
    return Math.max(0, total - adv); // amount to receive more
};

function attachTotalCalculator(form) {
    if (!form) return;
    const update = () => {
        const totalEl = form.querySelector("[data-total]");
        const balEl = form.querySelector("[data-balance]");
        if (!totalEl && !balEl) return;
        const est = form.elements.estimate?.value;
        const tax = form.elements.taxPercent?.value;
        const adv = form.elements.advance?.value;
        if (totalEl) totalEl.value = calcTotal(est, tax).toFixed(2);
        if (balEl) balEl.value = calcBalance(est, tax, adv).toFixed(2);
    };
    if (!form.dataset.totalAttached) {
        form.addEventListener("input", (e) => {
            if (!e.target) return;
            if (["estimate", "taxPercent", "advance"].includes(e.target.name))
                update();
        });
        form.dataset.totalAttached = "1";
    }
    update(); // initial set
}

// ---- Print CSS for popup (kept minimal) ----
const PRINT_CSS = `
.print-sheet{font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial;color:#111;padding:16px;width:560px}
.print-head{border-bottom:1px solid #ddd;padding-bottom:8px;margin-bottom:10px}
.print-head h2{margin:0 0 4px 0;font-size:18px}
.print-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;margin:10px 0}
.print-table{width:100%;border-collapse:collapse;margin:10px 0}
.print-table td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}
.print-foot{margin-top:12px;border-top:1px dashed #bbb;padding-top:8px;font-size:12px;color:#444}
`;

// ---------- Initialize UI ----------
function boot() {
    shopTitle.textContent = settings.name || "Service Job Card";
    shopSub.textContent = settings.address
        ? settings.address.split("\n")[0]
        : "Offline • LocalStorage";

    // Restore draft in form
    Object.entries(draft).forEach(([k, v]) => {
        const el = jobForm.elements[k];
        if (el) el.value = v;
    });

    attachTotalCalculator(jobForm);
    renderBoard();
}
boot();

// ---------- Drawer handlers ----------
btnNew.addEventListener("click", () => drawer.classList.add("open"));
btnCloseDrawer.addEventListener("click", () => drawer.classList.remove("open"));

// Autosave draft on input
jobForm.addEventListener("input", () => {
    const data = Object.fromEntries(new FormData(jobForm));
    writeStore(LS_KEYS.DRAFT, data);
});

// Create Job
jobForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(jobForm));

    const job = {
        id: nextId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: {
            name: data.customerName?.trim() || "",
            phone: data.customerPhone?.trim() || "",
        },
        item: {
            type: data.itemType || "",
            brand: data.itemBrand || "",
            model: data.itemModel || "",
            serial: data.itemSerial || "",
        },
        issue: data.issue || "",
        accessories: data.accessories || "",
        estimate: {
            amount: Number(data.estimate || 0),
            notes: "",
            advance: Number(data.advance || 0),
            taxPercent: Number(data.taxPercent || 0),
        },
        status: "new",
        promisedAt: data.promisedAt || "",
        readyAt: "",
        pickedAt: "",
        billing: { finalAmount: 0, balance: 0, paymentMode: "" },
        notes: data.notes || "",
    };

    jobs.unshift(job);
    writeStore(LS_KEYS.JOBS, jobs);
    writeStore(LS_KEYS.DRAFT, {}); // clear draft
    jobForm.reset();
    drawer.classList.remove("open");
    alert(`Job ${job.id} created.`);
    renderBoard();
});

// ---------- Search ----------
searchInput.addEventListener("input", renderBoard);

// ---------- Export / Import / Reset ----------
btnExport.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ jobs, settings }, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service-job-card-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

importFile.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("Importing will REPLACE current jobs & settings. Continue?"))
        return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            jobs = data.jobs ?? [];
            settings = data.settings ?? settings;
            writeStore(LS_KEYS.JOBS, jobs);
            writeStore(LS_KEYS.SETTINGS, settings);
            boot();
            alert("Import successful.");
        } catch (err) {
            alert("Invalid JSON.");
        }
    };
    reader.readAsText(file);
    importFile.value = "";
});

btnReset.addEventListener("click", () => {
    if (
        !confirm(
            "This will permanently clear ALL data (jobs, settings, drafts). Are you sure?"
        )
    )
        return;
    localStorage.removeItem(LS_KEYS.JOBS);
    localStorage.removeItem(LS_KEYS.SETTINGS);
    localStorage.removeItem(LS_KEYS.DRAFT);
    jobs = [];
    settings = { name: "Service Job Card", address: "", phone: "" };
    boot();
    alert("All data cleared.");
});

// ---------- Settings ----------
btnSettings.addEventListener("click", () => {
    settingsModal.classList.add("open");
    settingsForm.name.value = settings.name || "";
    settingsForm.address.value = settings.address || "";
    settingsForm.phone.value = settings.phone || "";
});
closeSettings.addEventListener("click", () =>
    settingsModal.classList.remove("open")
);
btnSettingsClear.addEventListener("click", () => {
    settingsForm.reset();
});
settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(settingsForm));
    settings = {
        name: data.name || "Service Job Card",
        address: data.address || "",
        phone: data.phone || "",
    };
    writeStore(LS_KEYS.SETTINGS, settings);
    settingsModal.classList.remove("open");
    boot();
});

// ---------- Board Rendering ----------
function renderBoard() {
    const q = searchInput.value?.toLowerCase().trim() || "";
    const match = (j) => {
        if (!q) return true;
        return [
            j.id,
            j.customer.name,
            j.customer.phone,
            j.item.type,
            j.item.brand,
            j.item.model,
            j.item.serial,
            j.issue,
            j.accessories,
            j.notes,
        ]
            .join(" ")
            .toLowerCase()
            .includes(q);
    };

    const lists = { new: [], in_progress: [], ready: [], picked_up: [] };
    jobs.filter(match).forEach((j) => lists[j.status]?.push(j));

    [colNew, colIn, colReady, colPicked].forEach((el) => (el.innerHTML = ""));

    for (const st of ["new", "in_progress", "ready", "picked_up"]) {
        const host = document.getElementById(`col-${st}`);
        lists[st].forEach((job) => host.appendChild(makeCard(job)));
    }
    shopTitle.textContent = settings.name || "Service Job Card";
}

function makeCard(job) {
    const node = cardTpl.content.firstElementChild.cloneNode(true);

    $(".id", node).textContent = job.id;
    const promised = job.promisedAt
        ? `Promised ${fmtDateTime(job.promisedAt)}`
        : "No promise";
    $(".promised", node).textContent = promised;

    $(".name", node).textContent = `${job.customer.name || "—"} (${
        job.customer.phone || "—"
    })`;
    $(".item", node).textContent =
        [job.item.type, job.item.brand, job.item.model]
            .filter(Boolean)
            .join(" · ") || "—";
    $(".issue", node).textContent = job.issue || "—";

    $(".view", node).addEventListener("click", () => openJob(job.id));
    $(".print", node).addEventListener("click", () => printTicket(job));
    $(".del", node).addEventListener("click", () => {
        if (!confirm(`Delete job ${job.id}? This cannot be undone.`)) return;
        jobs = jobs.filter((j) => j.id !== job.id);
        writeStore(LS_KEYS.JOBS, jobs);
        renderBoard();
    });

    return node;
}

// ---------- Job Modal ----------
function openJob(id) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    jobModal.classList.add("open");
    jobDetailForm.reset();

    jobDetailForm.elements.id.value = job.id;
    detailId.textContent = job.id;
    detailStatus.textContent = labelStatus(job.status);
    detailCreated.textContent = fmtDateTime(job.createdAt);

    // Fill fields
    jobDetailForm.customerName.value = job.customer.name || "";
    jobDetailForm.customerPhone.value = job.customer.phone || "";
    jobDetailForm.itemType.value = job.item.type || "";
    jobDetailForm.itemBrand.value = job.item.brand || "";
    jobDetailForm.itemModel.value = job.item.model || "";
    jobDetailForm.itemSerial.value = job.item.serial || "";
    jobDetailForm.issue.value = job.issue || "";
    jobDetailForm.accessories.value = job.accessories || "";
    jobDetailForm.estimate.value = job.estimate.amount || 0;
    jobDetailForm.advance.value = job.estimate.advance || 0;
    jobDetailForm.taxPercent.value = job.estimate.taxPercent || 0;
    jobDetailForm.promisedAt.value = job.promisedAt
        ? job.promisedAt.slice(0, 16)
        : "";
    jobDetailForm.notes.value = job.notes || "";

    // Attach + update totals/balance
    attachTotalCalculator(jobDetailForm);

    // Move buttons
    btnToNew.disabled = job.status === "new";
    btnToIn.disabled = job.status === "in_progress";
    btnToReady.disabled = job.status === "ready";
    btnPickup.disabled = job.status === "picked_up";

    btnToNew.onclick = () => moveStatus(job.id, "new");
    btnToIn.onclick = () => moveStatus(job.id, "in_progress");
    btnToReady.onclick = () => moveStatus(job.id, "ready");
    btnPickup.onclick = () => doPickup(job.id);
    btnPrintTicket.onclick = () => printTicket(job);
    btnDeleteJob.onclick = () => {
        if (!confirm(`Delete job ${job.id}?`)) return;
        jobs = jobs.filter((j) => j.id !== job.id);
        writeStore(LS_KEYS.JOBS, jobs);
        jobModal.classList.remove("open");
        renderBoard();
    };
}

closeJobModal.addEventListener("click", () =>
    jobModal.classList.remove("open")
);

jobDetailForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = jobDetailForm.elements.id.value;
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    const data = Object.fromEntries(new FormData(jobDetailForm));
    job.updatedAt = new Date().toISOString();
    job.customer.name = data.customerName || "";
    job.customer.phone = data.customerPhone || "";
    job.item.type = data.itemType || "";
    job.item.brand = data.itemBrand || "";
    job.item.model = data.itemModel || "";
    job.item.serial = data.itemSerial || "";
    job.issue = data.issue || "";
    job.accessories = data.accessories || "";
    job.estimate.amount = Number(data.estimate || 0);
    job.estimate.advance = Number(data.advance || 0);
    job.estimate.taxPercent = Number(data.taxPercent || 0);
    job.promisedAt = data.promisedAt || "";
    job.notes = data.notes || "";

    writeStore(LS_KEYS.JOBS, jobs);
    alert("Saved.");
    renderBoard();
    openJob(id); // refresh fields/buttons and totals
});

function labelStatus(st) {
    return (
        {
            new: "New",
            in_progress: "In-Progress",
            ready: "Ready",
            picked_up: "Picked-Up",
        }[st] || st
    );
}

function moveStatus(id, to) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    if (!confirm(`Move ${job.id} → ${labelStatus(to)}?`)) return;
    job.status = to;
    job.updatedAt = new Date().toISOString();
    if (to === "ready") job.readyAt = new Date().toISOString();
    writeStore(LS_KEYS.JOBS, jobs);
    renderBoard();
    openJob(id);
}

function doPickup(id) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    const finalStr = prompt(
        `Final amount for ${job.id}?`,
        job.estimate.amount.toFixed(2)
    );
    if (finalStr === null) return; // cancel
    const finalAmount = Number(finalStr || 0);
    const balance = Math.max(
        0,
        finalAmount - Number(job.estimate.advance || 0)
    );
    const pm = prompt(`Payment mode? (UPI/Card/Cash)`, "UPI") || "";

    if (
        !confirm(
            `Confirm pickup?\nFinal: ${currency(
                finalAmount
            )}\nAdvance: ${currency(job.estimate.advance)}\nBalance: ${currency(
                balance
            )}\nPayment: ${pm}`
        )
    )
        return;

    job.billing.finalAmount = finalAmount;
    job.billing.balance = balance;
    job.billing.paymentMode = pm;
    job.pickedAt = new Date().toISOString();
    job.status = "picked_up";
    job.updatedAt = new Date().toISOString();

    writeStore(LS_KEYS.JOBS, jobs);
    alert("Marked as Picked-Up.");
    renderBoard();
    openJob(id);
}

// ---------- Print Ticket ----------
function printTicket(job) {
    const win = window.open("", "_blank");
    if (!win) return alert("Popup blocked. Allow popups to print.");
    const est = job.estimate.amount || 0;
    const tax = (est * (Number(job.estimate.taxPercent) || 0)) / 100;
    const sub = est;
    const grand = sub + tax;
    const advance = Number(job.estimate.advance || 0);
    const balance = Math.max(0, grand - advance);

    const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Ticket ${job.id}</title>
      <style>${PRINT_CSS}</style>
    </head>
    <body>
      <div class="print-sheet">
        <div class="print-head">
          <h2>${escapeHtml(settings.name || "Service Job Card")}</h2>
          <div>${escapeHtml(settings.address || "")}</div>
          <div>${escapeHtml(settings.phone || "")}</div>
        </div>

        <div class="print-meta">
          <div><b>Job ID:</b> ${job.id}</div>
          <div><b>Date:</b> ${fmtDateTime(job.createdAt)}</div>
          <div><b>Customer:</b> ${escapeHtml(job.customer.name || "—")}</div>
          <div><b>Phone:</b> ${escapeHtml(job.customer.phone || "—")}</div>
        </div>

        <table class="print-table">
          <tr><td><b>Item</b></td><td>${escapeHtml(
              [job.item.type, job.item.brand, job.item.model, job.item.serial]
                  .filter(Boolean)
                  .join(" · ") || "—"
          )}</td></tr>
          <tr><td><b>Issue</b></td><td>${escapeHtml(job.issue || "—")}</td></tr>
          <tr><td><b>Accessories</b></td><td>${escapeHtml(
              job.accessories || "—"
          )}</td></tr>
          <tr><td><b>Promised</b></td><td>${
              job.promisedAt ? fmtDateTime(job.promisedAt) : "—"
          }</td></tr>
        </table>

        <table class="print-table">
          <tr><td>Subtotal</td><td style="text-align:right">${currency(
              sub
          )}</td></tr>
          <tr><td>Tax (${Number(
              job.estimate.taxPercent || 0
          )}%)</td><td style="text-align:right">${currency(tax)}</td></tr>
          <tr><td><b>Grand Total</b></td><td style="text-align:right"><b>${currency(
              grand
          )}</b></td></tr>
          <tr><td>Advance</td><td style="text-align:right">${currency(
              advance
          )}</td></tr>
          <tr><td><b>Balance</b></td><td style="text-align:right"><b>${currency(
              balance
          )}</b></td></tr>
        </table>

        <div class="print-foot">
          * Items left beyond 30 days may incur storage charges. Physical damage/liquid damage at owner's risk.
          <br />* This is a computer-generated receipt.
        </div>
      </div>
      <script>window.print();<\/script>
    </body>
  </html>`;
    win.document.write(html);
    win.document.close();
}

function escapeHtml(str) {
    return String(str).replace(
        /[&<>"']/g,
        (s) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
            }[s])
    );
}

// ---------- Global keyboard shortcuts ----------
window.addEventListener("keydown", (e) => {
    if (e.key === "N" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        drawer.classList.add("open");
        e.preventDefault();
    }
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        searchInput.focus();
        e.preventDefault();
    }
});
