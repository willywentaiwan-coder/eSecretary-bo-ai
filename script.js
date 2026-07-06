const storageKey = "boai-checkin-v1";
const quorumRate = 60;

const fields = {
  eventName: document.getElementById("eventName"),
  eventDate: document.getElementById("eventDate"),
  eventPlace: document.getElementById("eventPlace"),
  expectedCount: document.getElementById("expectedCount"),
  personName: document.getElementById("personName"),
  role: document.getElementById("role"),
  groupName: document.getElementById("groupName"),
  phone: document.getElementById("phone"),
  isProxy: document.getElementById("isProxy"),
  proxyName: document.getElementById("proxyName"),
  proxyRole: document.getElementById("proxyRole"),
  proxyGroupName: document.getElementById("proxyGroupName"),
  note: document.getElementById("note"),
  searchInput: document.getElementById("searchInput")
};

const attendeeRows = document.getElementById("attendeeRows");
const emptyState = document.getElementById("emptyState");
const proxyFields = document.getElementById("proxyFields");
const checkedCount = document.getElementById("checkedCount");
const lateCount = document.getElementById("lateCount");
const rateText = document.getElementById("rateText");
const eventLine = document.getElementById("eventLine");

let state = loadState();

function loadState() {
  const fallback = {
    eventName: "家長會會議簽到",
    eventDate: new Date().toISOString().slice(0, 10),
    eventPlace: "",
    expectedCount: "",
    attendees: []
  };

  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function syncFields() {
  fields.eventName.value = state.eventName;
  fields.eventDate.value = state.eventDate;
  fields.eventPlace.value = state.eventPlace;
  fields.expectedCount.value = state.expectedCount;
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function nowParts(date = new Date()) {
  return {
    iso: date.toISOString(),
    time: date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })
  };
}

function isLate(iso) {
  const date = new Date(iso);
  return date.getHours() > 19 || (date.getHours() === 19 && date.getMinutes() > 10);
}

function addAttendee(attendee) {
  state.attendees.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    ...nowParts(),
    ...attendee
  });
  saveState();
  render();
}

function removeAttendee(id) {
  state.attendees = state.attendees.filter((attendee) => attendee.id !== id);
  saveState();
  render();
}

function filteredAttendees() {
  const keyword = clean(fields.searchInput.value).toLowerCase();
  if (!keyword) return state.attendees;

  return state.attendees.filter((attendee) => [
    attendee.name,
    attendee.role,
    attendee.groupName,
    attendee.phone,
    attendee.proxyName,
    attendee.proxyRole,
    attendee.proxyGroupName,
    attendee.note
  ].some((value) => String(value || "").toLowerCase().includes(keyword)));
}

function proxyText(attendee) {
  if (!attendee.isProxy) return "-";
  const details = [
    attendee.proxyName || "未填姓名",
    attendee.proxyRole || "未填身分",
    attendee.proxyGroupName || "未填班級"
  ];
  return `代理 ${details.join(" / ")}`;
}

function renderSummary() {
  const expected = Number(state.expectedCount) || 0;
  const signed = state.attendees.length;
  const late = state.attendees.filter((attendee) => isLate(attendee.iso)).length;
  const attendanceRate = expected ? Math.round((signed / expected) * 100) : 0;

  checkedCount.textContent = signed;
  lateCount.textContent = late;
  rateText.textContent = `${attendanceRate}%`;
  rateText.classList.toggle("quorum-reached", expected > 0 && attendanceRate >= quorumRate);
  rateText.closest("div").classList.toggle("quorum-card", expected > 0 && attendanceRate >= quorumRate);

  const details = [
    state.eventDate || "未設定日期",
    state.eventPlace || "未設定地點",
    expected ? `預計 ${expected} 人` : "未設定預計人數"
  ];
  eventLine.textContent = `${state.eventName || "未命名活動"}｜${details.join("｜")}`;
}

function renderRows() {
  const attendees = filteredAttendees();
  attendeeRows.innerHTML = "";

  for (const attendee of attendees) {
    const row = document.createElement("tr");
    if (isLate(attendee.iso)) row.classList.add("late-row");
    row.innerHTML = `
      <td>${escapeHtml(attendee.time)}</td>
      <td>${escapeHtml(attendee.name)}</td>
      <td>${escapeHtml(attendee.role)}</td>
      <td>${escapeHtml(attendee.groupName || "-")}</td>
      <td>${escapeHtml(attendee.phone || "-")}</td>
      <td>${escapeHtml(proxyText(attendee))}</td>
      <td>${escapeHtml(attendee.note || "-")}</td>
      <td><button type="button" class="text-button" data-id="${escapeHtml(attendee.id)}">刪除</button></td>
    `;
    attendeeRows.appendChild(row);
  }

  if (state.attendees.length === 0) {
    emptyState.textContent = "還沒有簽到資料。現場可以從上方表單開始登記。";
    emptyState.hidden = false;
  } else if (attendees.length === 0) {
    emptyState.textContent = "找不到符合搜尋條件的簽到資料。";
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
  }
  document.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => removeAttendee(button.dataset.id));
  });
}

function render() {
  renderSummary();
  renderRows();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  const header = ["活動名稱", "日期", "地點", "簽到時間", "姓名", "身分", "班級/單位", "電話", "是否代理", "代理姓名", "代理身分", "代理班級/單位", "備註"];
  const rows = state.attendees.map((attendee) => [
    state.eventName,
    state.eventDate,
    state.eventPlace,
    attendee.time,
    attendee.name,
    attendee.role,
    attendee.groupName,
    attendee.phone,
    attendee.isProxy ? "是" : "否",
    attendee.proxyName,
    attendee.proxyRole,
    attendee.proxyGroupName,
    attendee.note
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.eventName || "簽到名冊"}-${state.eventDate || "未設定日期"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.getElementById("checkinForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = clean(fields.personName.value);
  if (!name) return;

  addAttendee({
    name,
    role: fields.role.value,
    groupName: clean(fields.groupName.value),
    phone: clean(fields.phone.value),
    isProxy: fields.isProxy.checked,
    proxyName: fields.isProxy.checked ? clean(fields.proxyName.value) : "",
    proxyRole: fields.isProxy.checked ? fields.proxyRole.value : "",
    proxyGroupName: fields.isProxy.checked ? clean(fields.proxyGroupName.value) : "",
    note: clean(fields.note.value)
  });

  fields.personName.value = "";
  fields.groupName.value = "";
  fields.phone.value = "";
  fields.isProxy.checked = false;
  fields.proxyName.value = "";
  fields.proxyRole.value = "家長代表";
  fields.proxyGroupName.value = "";
  proxyFields.hidden = true;
  fields.note.value = "";
  fields.personName.focus();
});

for (const key of ["eventName", "eventDate", "eventPlace", "expectedCount"]) {
  fields[key].addEventListener("input", () => {
    state[key] = fields[key].value;
    saveState();
    render();
  });
}

fields.searchInput.addEventListener("input", renderRows);
fields.isProxy.addEventListener("change", () => {
  proxyFields.hidden = !fields.isProxy.checked;
  if (fields.isProxy.checked) fields.proxyName.focus();
});
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document.getElementById("clearBtn").addEventListener("click", () => {
  if (!confirm("確定要清空目前簽到名單嗎？活動資料會保留。")) return;
  state.attendees = [];
  saveState();
  render();
});
document.getElementById("sampleBtn").addEventListener("click", () => {
  addAttendee({
    name: "王小明",
    role: "家長代表",
    groupName: "三年二班",
    phone: "0912-345-678",
    isProxy: true,
    proxyName: "林大華",
    proxyRole: "家長委員",
    proxyGroupName: "三年二班",
    note: "範例資料"
  });
});

syncFields();
render();
