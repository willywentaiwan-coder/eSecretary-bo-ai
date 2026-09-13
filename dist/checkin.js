const storageKey = "boai-secure-checkin-v1";
const backendUrl = String(window.BOAI_CHECKIN_BACKEND_URL || "").trim();

const fields = {
  backendUrl: document.getElementById("backendUrl"),
  meetingCode: document.getElementById("meetingCode"),
  checkinCode: document.getElementById("checkinCode"),
  eventName: document.getElementById("eventName"),
  eventDate: document.getElementById("eventDate"),
  eventPlace: document.getElementById("eventPlace"),
  expectedCount: document.getElementById("expectedCount"),
  personName: document.getElementById("personName"),
  role: document.getElementById("role"),
  groupName: document.getElementById("groupName"),
  phone: document.getElementById("phone"),
  isProxy: document.getElementById("isProxy"),
  proxyCode: document.getElementById("proxyCode"),
  proxyName: document.getElementById("proxyName"),
  proxyRole: document.getElementById("proxyRole"),
  proxyGroupName: document.getElementById("proxyGroupName"),
  note: document.getElementById("note")
};

const codeLookupStatus = document.getElementById("codeLookupStatus");
const proxyLookupStatus = document.getElementById("proxyLookupStatus");
const meetingTitle = document.getElementById("meetingTitle");
const meetingLine = document.getElementById("meetingLine");
const proxyFields = document.getElementById("proxyFields");
const submitBtn = document.getElementById("submitBtn");
const receiptPanel = document.getElementById("receiptPanel");

const lookupCache = new Map();
let state = loadState();
let lookupTimer = null;
let proxyLookupTimer = null;

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function loadState() {
  const fallback = {
    backendUrl,
    meetingCode: "",
    eventName: "家長會會議簽到",
    eventDate: "",
    eventPlace: "",
    expectedCount: "",
    attendees: []
  };
  const saved = loadJson(storageKey);

  return {
    ...fallback,
    ...saved,
    backendUrl
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function setLookupStatus(element, message, tone = "") {
  element.textContent = message;
  element.classList.toggle("ready", tone === "ready");
  element.classList.toggle("error", tone === "error");
}

function nowParts(date = new Date()) {
  return {
    localIso: date.toISOString(),
    localTime: date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })
  };
}

function backendReady() {
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(state.backendUrl);
}

function meetingAttendees(meetingCode = state.meetingCode) {
  const code = clean(meetingCode).toUpperCase();
  const saved = loadJson(storageKey);
  const attendees = Array.isArray(saved.attendees) ? saved.attendees : state.attendees;
  return Array.isArray(attendees)
    ? attendees.filter((attendee) => clean(attendee.meetingCode).toUpperCase() === code)
    : [];
}

function usedCodesForMeeting(meetingCode = state.meetingCode) {
  const used = new Set();
  for (const attendee of meetingAttendees(meetingCode)) {
    const checkinCode = onlyDigits(attendee.checkinCode);
    const proxyCode = onlyDigits(attendee.proxyCode);
    if (checkinCode) used.add(checkinCode);
    if (attendee.isProxy && proxyCode) used.add(proxyCode);
  }
  return used;
}

function codeAlreadyUsed(code, meetingCode = state.meetingCode) {
  return usedCodesForMeeting(meetingCode).has(onlyDigits(code));
}

function syncFields() {
  fields.backendUrl.value = state.backendUrl;
  fields.meetingCode.value = state.meetingCode;
  fields.eventName.value = state.eventName;
  fields.eventDate.value = state.eventDate;
  fields.eventPlace.value = state.eventPlace;
  fields.expectedCount.value = state.expectedCount;
}

function renderMeeting() {
  const details = [
    state.eventDate,
    state.eventPlace,
    state.expectedCount ? `預計 ${state.expectedCount} 人` : ""
  ].filter(Boolean);

  meetingTitle.textContent = state.eventName || "家長會會議簽到";
  meetingLine.textContent = details.length
    ? details.join("｜")
    : "請依秘書處公告輸入簽到碼。";
}

function render() {
  renderMeeting();
  submitBtn.textContent = "簽到";
}

async function requestBackend(params, payload) {
  if (!backendReady()) throw new Error("尚未完成雲端簽到設定，請聯絡秘書處。");

  const url = new URL(state.backendUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const options = payload
    ? {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      }
    : undefined;

  const response = await fetch(url.toString(), options);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "雲端簽到沒有完成");
  return result;
}

function applyMeetingFromLookup(result) {
  state.meetingCode = clean(result.meetingCode).toUpperCase() || state.meetingCode;
  state.eventName = clean(result.eventName) || state.eventName;
  state.eventDate = clean(result.eventDate) || state.eventDate;
  state.eventPlace = clean(result.eventPlace) || state.eventPlace;
  state.expectedCount = clean(result.expectedCount) || state.expectedCount;
  syncFields();
  saveState();
  render();
}

function applyRepresentative(rep, target) {
  target.name.value = rep.name || "";
  target.role.value = rep.role || "家長代表";
  target.groupName.value = rep.groupName || "";
}

function clearLookupFields() {
  fields.personName.value = "";
  fields.groupName.value = "";
  fields.isProxy.checked = false;
  clearProxyLookupFields();
  proxyFields.hidden = true;
}

function clearProxyLookupFields() {
  fields.proxyCode.value = "";
  fields.proxyName.value = "";
  fields.proxyRole.value = "家長代表";
  fields.proxyGroupName.value = "";
  setLookupStatus(proxyLookupStatus, "輸入被代理人的簽到碼後，會自動帶入資料。");
}

function resetProxySection() {
  fields.isProxy.checked = false;
  clearProxyLookupFields();
  proxyFields.hidden = true;
}

function useLookupResult(code, result, statusElement) {
  applyMeetingFromLookup(result);

  if (result.status && result.status !== "未使用") {
    setLookupStatus(statusElement, "這組簽到碼已經完成簽到，不能重複使用。", "error");
    return null;
  }

  if (codeAlreadyUsed(code, result.meetingCode)) {
    setLookupStatus(statusElement, "這組簽到碼已經完成簽到，不能重複使用。", "error");
    return null;
  }

  const representative = result.representative || {};
  if (statusElement === codeLookupStatus) {
    applyRepresentative(representative, {
      name: fields.personName,
      role: fields.role,
      groupName: fields.groupName
    });
    if (!fields.isProxy.checked) resetProxySection();
    if (fields.isProxy.checked) lookupProxyCode();
    setLookupStatus(
      codeLookupStatus,
      `已帶入：${fields.personName.value || "未填姓名"}${fields.groupName.value ? `｜${fields.groupName.value}` : ""}。`,
      "ready"
    );
  }

  return { meetingCode: result.meetingCode, checkinCode: code, representative };
}

async function lookupCode() {
  const normalizedCode = onlyDigits(fields.checkinCode.value);
  if (fields.checkinCode.value !== normalizedCode) fields.checkinCode.value = normalizedCode;

  if (!normalizedCode) {
    clearLookupFields();
    setLookupStatus(codeLookupStatus, "輸入自己的 4 位簽到碼後，會自動帶入資料。");
    return null;
  }

  if (normalizedCode.length < 4) {
    clearLookupFields();
    setLookupStatus(codeLookupStatus, "請輸入完整 4 位數字。");
    return null;
  }

  if (!backendReady()) {
    clearLookupFields();
    setLookupStatus(codeLookupStatus, "尚未完成雲端簽到設定，請聯絡秘書處。", "error");
    return null;
  }

  if (lookupCache.has(normalizedCode)) {
    return useLookupResult(normalizedCode, lookupCache.get(normalizedCode), codeLookupStatus);
  }

  setLookupStatus(codeLookupStatus, "正在比對簽到碼...");
  try {
    const result = await requestBackend({ action: "lookup", checkinCode: normalizedCode });
    lookupCache.set(normalizedCode, result);
    return useLookupResult(normalizedCode, result, codeLookupStatus);
  } catch (error) {
    clearLookupFields();
    setLookupStatus(codeLookupStatus, error.message || "找不到這組簽到碼，請確認是否為本次會議。", "error");
    return null;
  }
}

function useProxyLookupResult(code, result) {
  if (result.status && result.status !== "未使用") {
    setLookupStatus(proxyLookupStatus, "這組被代理人的簽到碼已經完成簽到，不能重複使用。", "error");
    return null;
  }

  if (codeAlreadyUsed(code, result.meetingCode || state.meetingCode)) {
    setLookupStatus(proxyLookupStatus, "這組被代理人的簽到碼已經完成簽到，不能重複使用。", "error");
    return null;
  }

  const representative = result.representative || {};
  applyRepresentative(representative, {
    name: fields.proxyName,
    role: fields.proxyRole,
    groupName: fields.proxyGroupName
  });
  setLookupStatus(proxyLookupStatus, `已帶入：代理 ${fields.proxyName.value || "被代理人"}。`, "ready");
  return { checkinCode: code, representative };
}

async function lookupProxyCode() {
  const normalizedCode = onlyDigits(fields.proxyCode.value);
  if (fields.proxyCode.value !== normalizedCode) fields.proxyCode.value = normalizedCode;

  if (!fields.isProxy.checked) return null;

  if (!normalizedCode) {
    fields.proxyName.value = "";
    fields.proxyRole.value = "家長代表";
    fields.proxyGroupName.value = "";
    setLookupStatus(proxyLookupStatus, "輸入被代理人的簽到碼後，會自動帶入資料。");
    return null;
  }

  if (normalizedCode.length < 4) {
    fields.proxyName.value = "";
    fields.proxyRole.value = "家長代表";
    fields.proxyGroupName.value = "";
    setLookupStatus(proxyLookupStatus, "請輸入完整 4 位數字。");
    return null;
  }

  const ownCode = onlyDigits(fields.checkinCode.value);
  if (normalizedCode === ownCode) {
    fields.proxyName.value = "";
    fields.proxyRole.value = "家長代表";
    fields.proxyGroupName.value = "";
    setLookupStatus(proxyLookupStatus, "被代理人的簽到碼不能和自己的簽到碼相同。", "error");
    return null;
  }

  if (lookupCache.has(normalizedCode)) {
    return useProxyLookupResult(normalizedCode, lookupCache.get(normalizedCode));
  }

  setLookupStatus(proxyLookupStatus, "正在比對被代理人的簽到碼...");
  try {
    const result = await requestBackend({ action: "lookup", checkinCode: normalizedCode });
    lookupCache.set(normalizedCode, result);
    return useProxyLookupResult(normalizedCode, result);
  } catch (error) {
    fields.proxyName.value = "";
    fields.proxyRole.value = "家長代表";
    fields.proxyGroupName.value = "";
    setLookupStatus(proxyLookupStatus, error.message || "找不到這組被代理人的簽到碼。", "error");
    return null;
  }
}

async function sendToBackend(payload) {
  const result = await requestBackend({ action: "checkin" }, payload);
  return { synced: true, receiptCode: result.receiptCode };
}

function addAttendee(attendee) {
  state.attendees.unshift(attendee);
  saveState();
}

document.getElementById("checkinForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const lookup = await lookupCode();
  const meetingCode = clean(fields.meetingCode.value).toUpperCase();
  const checkinCode = onlyDigits(fields.checkinCode.value);
  const name = clean(fields.personName.value);

  if (!checkinCode || checkinCode.length < 4) {
    setLookupStatus(codeLookupStatus, "請先輸入自己的 4 位簽到碼。", "error");
    fields.checkinCode.focus();
    return;
  }

  if (!lookup || !meetingCode) {
    setLookupStatus(codeLookupStatus, "請先輸入本次會議的有效簽到碼。", "error");
    fields.checkinCode.focus();
    return;
  }

  if (!name) {
    fields.personName.focus();
    return;
  }

  const usedCodes = usedCodesForMeeting(meetingCode);
  if (usedCodes.has(checkinCode)) {
    setLookupStatus(codeLookupStatus, "這組簽到碼已經完成簽到，不能重複使用。", "error");
    fields.checkinCode.focus();
    return;
  }

  let proxyLookup = null;
  if (fields.isProxy.checked) {
    proxyLookup = await lookupProxyCode();
    if (!proxyLookup) {
      setLookupStatus(proxyLookupStatus, "請輸入有效的被代理人簽到碼。", "error");
      fields.proxyCode.focus();
      return;
    }
    if (usedCodes.has(onlyDigits(fields.proxyCode.value))) {
      setLookupStatus(proxyLookupStatus, "這組被代理人的簽到碼已經完成簽到，不能重複使用。", "error");
      fields.proxyCode.focus();
      return;
    }
  }

  state.meetingCode = meetingCode;
  saveState();

  const attendee = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    receiptCode: "",
    ...nowParts(),
    meetingCode,
    checkinCode,
    eventName: clean(fields.eventName.value) || state.eventName,
    eventDate: fields.eventDate.value || state.eventDate,
    eventPlace: clean(fields.eventPlace.value) || state.eventPlace,
    expectedCount: clean(fields.expectedCount.value) || state.expectedCount,
    name,
    role: fields.role.value,
    groupName: clean(fields.groupName.value),
    phone: clean(fields.phone.value),
    isProxy: fields.isProxy.checked,
    proxyCode: fields.isProxy.checked ? onlyDigits(fields.proxyCode.value) : "",
    proxyName: fields.isProxy.checked ? clean(fields.proxyName.value) : "",
    proxyRole: fields.isProxy.checked ? fields.proxyRole.value : "",
    proxyGroupName: fields.isProxy.checked ? clean(fields.proxyGroupName.value) : "",
    note: clean(fields.note.value),
    userAgent: navigator.userAgent
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "簽到中...";
  let completed = false;

  try {
    const result = await sendToBackend(attendee);
    addAttendee({ ...attendee, receiptCode: result.receiptCode, synced: result.synced });
    lookupCache.delete(checkinCode);
    if (attendee.proxyCode) lookupCache.delete(attendee.proxyCode);
    receiptPanel.hidden = false;

    fields.checkinCode.value = "";
    fields.personName.value = "";
    fields.groupName.value = "";
    fields.phone.value = "";
    resetProxySection();
    fields.note.value = "";
    setLookupStatus(codeLookupStatus, "輸入自己的 4 位簽到碼後，會自動帶入資料。");
    fields.checkinCode.focus();
    completed = true;
  } catch (error) {
    setLookupStatus(
      codeLookupStatus,
      error.message || "簽到沒有完成，請確認簽到碼後再試一次。",
      "error"
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "簽到";
    if (completed) render();
  }
});

fields.checkinCode.addEventListener("input", () => {
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(lookupCode, 250);
});

fields.proxyCode.addEventListener("input", () => {
  clearTimeout(proxyLookupTimer);
  proxyLookupTimer = setTimeout(lookupProxyCode, 250);
});

fields.isProxy.addEventListener("change", () => {
  proxyFields.hidden = !fields.isProxy.checked;
  if (fields.isProxy.checked) {
    lookupCode();
    fields.proxyCode.focus();
  } else {
    clearProxyLookupFields();
  }
});

syncFields();
render();
