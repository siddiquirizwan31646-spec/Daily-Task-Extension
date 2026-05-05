// popup.js

const DEFAULT_TASKS = [
  "Morning workout / walk",
  "Read for 30 minutes",
  "Check & reply emails",
  "Deep work session",
  "Drink 8 glasses of water",
  "Evening review / journal",
  "Sleep by 11 PM"
];

let state = { tasks: [], history: [] };

// ── INIT ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadState();
  await checkDailyReset();
  renderDate();
  renderTasks();
  renderSetup();
  renderHistory();
  setupTabs();
});

async function loadState() {
  const data = await chrome.storage.local.get(["tasks", "history", "lastReset"]);

  if (!data.tasks || data.tasks.length === 0) {
    state.tasks = DEFAULT_TASKS.map(name => ({ name, done: false, doneAt: null }));
  } else {
    state.tasks = data.tasks;
  }

  state.history = data.history || [];
  state.lastReset = data.lastReset || null;
}

async function saveState() {
  await chrome.storage.local.set({
    tasks: state.tasks,
    history: state.history,
    lastReset: state.lastReset
  });
}

// ── AUTO RESET ──────────────────────────────────────
async function checkDailyReset() {
  const today = getTodayKey();
  if (state.lastReset === today) return;

  // If we have a previous day to archive
  if (state.lastReset && state.lastReset !== today) {
    const record = {
      date: state.lastReset,
      tasks: state.tasks.map(t => ({ name: t.name, done: t.done }))
    };
    state.history.push(record);
  }

  // Reset for today
  state.tasks = state.tasks.map(t => ({ ...t, done: false, doneAt: null }));
  state.lastReset = today;
  await saveState();
}

// ── DATE ─────────────────────────────────────────────
function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function renderDate() {
  const d = new Date();
  const options = { weekday: "short", month: "short", day: "numeric" };
  document.getElementById("todayDate").textContent = d.toLocaleDateString("en-US", options).toUpperCase();
}

// ── TASKS ─────────────────────────────────────────────
function renderTasks() {
  const list = document.getElementById("taskList");
  const done = state.tasks.filter(t => t.done).length;
  const total = state.tasks.length;

  const pct = total > 0 ? (done / total) * 100 : 0;
  document.getElementById("progressBar").style.width = pct + "%";
  document.getElementById("progressText").textContent = `${done} / ${total} tasks done`;

  list.innerHTML = "";

  if (state.tasks.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:32px 0;color:#6b6b6b;font-size:12px;font-family:'DM Mono',monospace;">No tasks yet — go to Setup tab</div>`;
    return;
  }

  state.tasks.forEach((task, i) => {
    const item = document.createElement("div");
    item.className = `task-item${task.done ? " done" : ""}`;

    item.innerHTML = `
      <div class="task-check">${task.done ? "✓" : ""}</div>
      <div class="task-name">${escHtml(task.name)}</div>
      <div class="task-time">${task.doneAt ? fmtTime(task.doneAt) : ""}</div>
    `;

    item.addEventListener("click", () => toggleTask(i));
    list.appendChild(item);
  });
}

async function toggleTask(index) {
  const task = state.tasks[index];
  task.done = !task.done;
  task.doneAt = task.done ? new Date().toISOString() : null;
  await saveState();
  renderTasks();

  if (task.done) {
    const allDone = state.tasks.every(t => t.done);
    showToast(allDone ? "🎉 All tasks done!" : `✓ "${task.name}"`);
  }
}

// ── SETUP ─────────────────────────────────────────────
function renderSetup() {
  const container = document.getElementById("taskInputs");
  container.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    const name = state.tasks[i]?.name || "";
    const row = document.createElement("div");
    row.className = "task-input-row";
    row.innerHTML = `
      <span class="task-num">${i + 1}</span>
      <input class="task-input" type="text" placeholder="Task ${i + 1}..." value="${escHtml(name)}" maxlength="60" />
    `;
    container.appendChild(row);
  }

  document.getElementById("saveTasks").addEventListener("click", saveSetup);
}

async function saveSetup() {
  const inputs = document.querySelectorAll(".task-input");
  const names = Array.from(inputs).map(el => el.value.trim()).filter(Boolean);

  if (names.length === 0) return showToast("Enter at least 1 task");

  // Merge: preserve done state for existing tasks, add new ones
  state.tasks = Array.from({ length: 7 }, (_, i) => {
    const name = names[i] || "";
    const existing = state.tasks[i];
    return {
      name,
      done: existing?.done || false,
      doneAt: existing?.doneAt || null
    };
  }).filter(t => t.name);

  await saveState();
  renderTasks();
  showToast("Tasks saved!");
  switchTab("today");
}

// ── HISTORY ────────────────────────────────────────────
function renderHistory() {
  const container = document.getElementById("historyList");
  container.innerHTML = "";

  // Include today as a preview row
  const todayRecord = {
    date: getTodayKey(),
    tasks: state.tasks.map(t => ({ name: t.name, done: t.done })),
    isToday: true
  };

  const allRecords = [todayRecord, ...state.history].reverse();

  if (allRecords.length === 0) {
    container.innerHTML = `<div class="history-empty">No history yet</div>`;
    return;
  }

  allRecords.forEach((record, idx) => {
    const total = record.tasks.length;
    const done = record.tasks.filter(t => t.done).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    let scoreClass = "low";
    if (pct === 100) scoreClass = "full";
    else if (pct >= 50) scoreClass = "partial";

    const d = new Date(record.date + "T00:00:00");
    const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase();
    const label = record.isToday ? "TODAY" : dateStr;

    const wrap = document.createElement("div");
    wrap.className = "history-day";
    wrap.innerHTML = `
      <div class="history-day-header" data-idx="${idx}">
        <span class="history-date">${label}</span>
        <span class="history-score ${scoreClass}">${done}/${total} · ${pct}%</span>
      </div>
      <div class="history-tasks" id="ht-${idx}">
        ${record.tasks.map(t => `
          <div class="history-task-row ${t.done ? "done-row" : ""}">
            <div class="dot"></div>
            <span>${escHtml(t.name)}</span>
          </div>
        `).join("")}
      </div>
    `;

    const header = wrap.querySelector(".history-day-header");
    const taskList = wrap.querySelector(`#ht-${idx}`);

    header.addEventListener("click", () => {
      const isOpen = taskList.classList.contains("open");
      taskList.classList.toggle("open", !isOpen);
      header.classList.toggle("open", !isOpen);
    });

    // Auto-open today
    if (idx === 0) {
      taskList.classList.add("open");
      header.classList.add("open");
    }

    container.appendChild(wrap);
  });
}

// ── EXCEL DOWNLOAD ──────────────────────────────────────
document.getElementById("downloadBtn").addEventListener("click", downloadExcel);

function downloadExcel() {
  const todayRecord = {
    date: getTodayKey(),
    tasks: state.tasks.map(t => ({ name: t.name, done: t.done }))
  };

  const allRecords = [...state.history, todayRecord];

  if (allRecords.length === 0) {
    showToast("No data to export");
    return;
  }

  // Collect all unique task names
  const allTaskNames = [...new Set(
    allRecords.flatMap(r => r.tasks.map(t => t.name)).filter(Boolean)
  )];

  // Build CSV rows
  const headers = ["Date", "Day", ...allTaskNames, "Total Done", "Total Tasks", "Completion %"];
  const rows = allRecords.map(record => {
    const d = new Date(record.date + "T00:00:00");
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    const taskMap = {};
    record.tasks.forEach(t => { taskMap[t.name] = t.done; });

    const taskCols = allTaskNames.map(name => {
      if (!(name in taskMap)) return "N/A";
      return taskMap[name] ? "✓ Done" : "✗ Missed";
    });

    const done = record.tasks.filter(t => t.done).length;
    const total = record.tasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) + "%" : "0%";

    return [record.date, dayName, ...taskCols, done, total, pct];
  });

  // Build CSV string
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  // Download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-tasks-${getTodayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast("Excel file downloaded!");
}

// ── TABS ──────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${name}`).classList.add("active");
  if (name === "history") renderHistory();
}

// ── UTILS ─────────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}
