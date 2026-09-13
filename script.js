const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const filterButtons = document.querySelectorAll(".filter-button");
const recordCards = document.querySelectorAll(".record-card");
const pageTabs = document.querySelectorAll(".page-tab");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const suggestionForm = document.getElementById("suggestionForm");
const suggestionType = document.getElementById("suggestionType");
const suggestionContent = document.getElementById("suggestionContent");
const suggestionEmail = document.getElementById("suggestionEmail");
const suggestionPhone = document.getElementById("suggestionPhone");
const suggestionLine = document.getElementById("suggestionLine");
const volunteerForm = document.getElementById("volunteerForm");
const volunteerQuickContact = document.getElementById("volunteerQuickContact");
const poemButtons = document.querySelectorAll("[data-read-poem]");
const stopReadingButton = document.querySelector(".stop-reading-button");
const documentZoomButtons = document.querySelectorAll("[data-document-zoom]");
const fundraisingButton = document.querySelector("[data-fundraising-url]");
const fundraisingConfirmDialog = document.getElementById("fundraisingConfirmDialog");
const fundraisingConfirmProceed = document.getElementById("fundraisingConfirmProceed");

document.body.classList.add("tabs-enabled");

function showTab(tabName, shouldScroll = true) {
  pageTabs.forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active-panel", panel.dataset.tabPanel === tabName);
  });

  if (shouldScroll) {
    document.querySelector(".tab-shell")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function panelFromTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return "";
  return target.dataset.tabPanel || target.closest("[data-tab-panel]")?.dataset.tabPanel || "";
}

function closeNav() {
  siteNav?.classList.remove("open");
  document.body.classList.remove("nav-open");
  navToggle?.setAttribute("aria-expanded", "false");
}

function goToAnchor(targetId, updateUrl = true) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const panelName = panelFromTarget(targetId);
  if (panelName) showTab(panelName, false);

  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (updateUrl) {
    history.replaceState(null, "", `#${targetId}`);
  }
}

function tabFromHash() {
  const hash = window.location.hash.replace("#", "");
  if (hash === "overview") return "bulletin";
  if (hash === "dashboard") return "bulletin";
  if (hash === "history") return "photos";
  if (hash === "about") return "bulletin";
  const directPanel = panelFromTarget(hash);
  if (directPanel) return directPanel;
  return hash || "bulletin";
}

showTab(tabFromHash(), false);

pageTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    showTab(tabName);
    history.replaceState(null, "", `#${tabName}`);
  });
});

navToggle?.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("open");
  document.body.classList.toggle("nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href")?.replace("#", "");
    if (!targetId || !document.getElementById(targetId)) return;

    event.preventDefault();
    closeNav();
    goToAnchor(targetId);
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    recordCards.forEach((card) => {
      const shouldShow = filter === "all" || card.dataset.status === filter;
      card.hidden = !shouldShow;
    });
  });
});

function speakPoem(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 0.82;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

if ("speechSynthesis" in window) {
  poemButtons.forEach((button) => {
    button.addEventListener("click", () => {
      speakPoem(button.dataset.readPoem || "");
    });
  });

  stopReadingButton?.addEventListener("click", () => {
    window.speechSynthesis.cancel();
  });
} else {
  poemButtons.forEach((button) => {
    button.disabled = true;
    button.textContent = "無法朗讀";
  });
  if (stopReadingButton) stopReadingButton.disabled = true;
}

let documentFontSize = 16;

documentZoomButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.documentZoom === "increase" ? 1 : -1;
    documentFontSize = Math.min(22, Math.max(14, documentFontSize + direction));
    document.documentElement.style.setProperty("--document-font-size", `${documentFontSize}px`);
  });
});

fundraisingButton?.addEventListener("click", () => {
  const url = fundraisingButton.dataset.fundraisingUrl;
  const isActive = fundraisingButton.dataset.fundraisingState === "active";

  if (!url || !isActive) return;

  if (fundraisingConfirmDialog?.showModal) {
    fundraisingConfirmDialog.showModal();
    return;
  }

  const confirmed = window.confirm("愛心捐款與募款，皆自由樂捐、和遵循資訊公開及稅法列舉扣除等相關規定。");
  if (confirmed) {
    window.open(url, "_blank", "noopener");
  }
});

fundraisingConfirmProceed?.addEventListener("click", () => {
  const url = fundraisingButton?.dataset.fundraisingUrl;
  const isActive = fundraisingButton?.dataset.fundraisingState === "active";

  if (url && isActive) {
    window.open(url, "_blank", "noopener");
  }
});

suggestionForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const type = suggestionType.value;
  const content = suggestionContent.value.trim();
  const email = suggestionEmail.value.trim();
  const phone = suggestionPhone.value.trim();
  const line = suggestionLine.value.trim();
  const contactLines = [
    email ? `Email：${email}` : "",
    phone ? `電話：${phone}` : "",
    line ? `LINE ID：${line}` : ""
  ].filter(Boolean);

  if (!content) {
    suggestionContent.focus();
    return;
  }

  if (!contactLines.length) {
    suggestionEmail.focus();
    return;
  }

  const subject = `博愛國小家長會提案：${type}`;
  const body = [
    "博愛國小家長會您好：",
    "",
    "提案表單資料如下，請家長會協助了解或追蹤。",
    "",
    `提案類型：${type}`,
    "聯絡方式：",
    ...contactLines,
    "",
    "提案內容：",
    content,
    "",
    "謝謝。"
  ].join("\n");

  const mailto = [
    "mailto:boaipta@gmail.com",
    `?subject=${encodeURIComponent(subject)}`,
    `&body=${encodeURIComponent(body)}`
  ].join("");

  window.location.href = mailto;
});

volunteerQuickContact?.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = document.getElementById("volunteerQuickText")?.value.trim() || "";
  const contact = document.getElementById("volunteerQuickInfo")?.value.trim() || "";

  if (!contact) {
    document.getElementById("volunteerQuickInfo")?.focus();
    return;
  }

  const subject = "博愛國小志工團聯繫請求";
  const body = [
    "博愛國小家長會志工團您好：",
    "",
    "志工團聯繫請求資料如下，請窗口協助回覆。",
    "",
    `聯絡方式：${contact}`,
    "",
    "詢問或補充內容：",
    text || "未填寫",
    "",
    "謝謝。"
  ].join("\n");

  const mailto = [
    "mailto:boaipta@gmail.com",
    `?subject=${encodeURIComponent(subject)}`,
    `&body=${encodeURIComponent(body)}`
  ].join("");

  window.location.href = mailto;
});

volunteerForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const identity = document.getElementById("volunteerIdentity")?.value || "未填寫";
  const name = document.getElementById("volunteerName")?.value.trim() || "";
  const contact = document.getElementById("volunteerContact")?.value.trim() || "";
  const student = document.getElementById("volunteerStudent")?.value.trim() || "未填寫";
  const selectedRoles = Array.from(document.querySelectorAll('input[name="volunteerRole"]:checked'))
    .map((item) => item.value);

  if (!name) {
    document.getElementById("volunteerName")?.focus();
    return;
  }

  if (!contact) {
    document.getElementById("volunteerContact")?.focus();
    return;
  }

  const roles = selectedRoles.length ? selectedRoles.join("、") : "尚未選擇，請志工團協助聯絡說明";
  const subject = `博愛國小115學年志工意願：${name}`;
  const body = [
    "博愛國小家長會您好：",
    "",
    "115學年愛心家長志工意願資料如下。",
    "",
    `身分：${identity}`,
    `姓名：${name}`,
    `聯絡方式：${contact}`,
    `學生資訊：${student}`,
    `欲參加的組別：${roles}`,
    "",
    "請志工團或家長會窗口再與我聯絡，謝謝。"
  ].join("\n");

  const mailto = [
    "mailto:boaipta@gmail.com",
    `?subject=${encodeURIComponent(subject)}`,
    `&body=${encodeURIComponent(body)}`
  ].join("");

  window.location.href = mailto;
});
