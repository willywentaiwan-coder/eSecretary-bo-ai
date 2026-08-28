const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const filterButtons = document.querySelectorAll(".filter-button");
const recordCards = document.querySelectorAll(".record-card");
const pageTabs = document.querySelectorAll(".page-tab");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const suggestionForm = document.getElementById("suggestionForm");
const suggestionType = document.getElementById("suggestionType");
const suggestionContent = document.getElementById("suggestionContent");
const suggestionContact = document.getElementById("suggestionContact");
const volunteerForm = document.getElementById("volunteerForm");

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

function tabFromHash() {
  const hash = window.location.hash.replace("#", "");
  const directPanel = document.getElementById(hash)?.dataset.tabPanel;
  if (directPanel) return directPanel;
  if (hash === "history") return "photos";
  if (hash === "parent-questions") return "overview";
  if (hash === "about") return "dashboard";
  return hash || "overview";
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

siteNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    siteNav.classList.remove("open");
    document.body.classList.remove("nav-open");
    navToggle?.setAttribute("aria-expanded", "false");

    const targetId = link.getAttribute("href")?.replace("#", "");
    const panelName = document.getElementById(targetId)?.dataset.tabPanel || targetId;
    if (panelName) showTab(panelName, false);
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

suggestionForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const type = suggestionType.value;
  const content = suggestionContent.value.trim();
  const contact = suggestionContact.value.trim() || "未填寫";

  if (!content) {
    suggestionContent.focus();
    return;
  }

  const subject = `博愛國小家長會提案：${type}`;
  const body = [
    "博愛國小家長會您好：",
    "",
    "我想提出以下事項，請家長會協助了解或追蹤。",
    "",
    `提案類型：${type}`,
    `聯絡方式：${contact}`,
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
    "我想了解或加入115學年愛心家長志工，以下是我的意願資料。",
    "",
    `身分：${identity}`,
    `姓名：${name}`,
    `聯絡方式：${contact}`,
    `學生資訊：${student}`,
    `想參加的組別：${roles}`,
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
