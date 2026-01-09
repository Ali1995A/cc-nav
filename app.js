const LINKS_URL = "./links.json";
const STORAGE = {
  theme: "cc-nav:theme",
};

const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearch");
const themeToggle = document.getElementById("themeToggle");

function setStatus(text) {
  statusEl.textContent = text || "";
}

function normalize(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

function getPreferredTheme() {
  const saved = localStorage.getItem(STORAGE.theme);
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE.theme, theme);
  themeToggle.textContent = theme === "light" ? "浅色" : "深色";
}

function toTextForSearch(item) {
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
  return normalize([item.title, item.desc, tags, item.url].filter(Boolean).join(" "));
}

function formatHost(url) {
  try {
    const u = new URL(url, window.location.href);
    if (u.protocol === "file:") return "本地";
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hashToHue(text) {
  const s = normalize(text);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function getIconText(item) {
  if (typeof item?.icon === "string" && item.icon.trim()) return item.icon.trim();
  try {
    const u = new URL(item?.url || "", window.location.href);
    if (u.protocol === "file:") return "📁";
    const host = u.hostname.replace(/^www\./, "");
    return host ? host[0].toUpperCase() : "🔗";
  } catch {
    return "🔗";
  }
}

function makeIcon(item) {
  const icon = String(getIconText(item));
  const hue = hashToHue(item?.url || icon);

  // If user provides an image URL, render <img>, otherwise render text/emoji.
  if (/^(https?:|data:|file:)/i.test(icon)) {
    const img = makeEl("img", { class: "card__iconImg", src: icon, alt: "" });
    img.loading = "lazy";
    img.decoding = "async";
    return makeEl("div", { class: "card__icon", style: `--h:${hue}` }, [img]);
  }

  return makeEl("div", { class: "card__icon", style: `--h:${hue}` }, [makeEl("span", { class: "card__iconText", text: icon })]);
}

function makeEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const child of children) el.append(child);
  return el;
}

function render({ title, items }, query) {
  document.title = title ? `${title}` : "CC 导航";
  const q = normalize(query);

  const all = Array.isArray(items) ? items : [];
  const shown = q ? all.filter((it) => toTextForSearch(it).includes(q)) : all;

  gridEl.replaceChildren();
  for (const item of shown) {
    const meta = formatHost(item.url);
    const titleRow = makeEl("div", { class: "card__top" }, [
      makeEl("div", { class: "card__title", text: item.title || "未命名" }),
      makeEl("div", { class: "card__meta", text: meta }),
    ]);

    const desc = item.desc ? makeEl("div", { class: "card__desc", text: item.desc }) : null;
    const tags = Array.isArray(item.tags) && item.tags.length
      ? makeEl(
          "div",
          { class: "tags" },
          item.tags.slice(0, 8).map((t) => makeEl("span", { class: "tag", text: String(t) })),
        )
      : null;

    const infoChildren = [titleRow];
    if (desc) infoChildren.push(desc);
    if (tags) infoChildren.push(tags);

    const info = makeEl("div", { class: "card__info" }, infoChildren);
    const cardChildren = [makeIcon(item), info];

    const a = makeEl(
      "a",
      {
        class: "card",
        href: item.url || "#",
        target: item.url && !String(item.url).startsWith("file:") ? "_blank" : "_self",
        rel: "noopener noreferrer",
      },
      cardChildren,
    );
    gridEl.append(a);
  }

  if (q) setStatus(shown.length ? `“${query}”：共 ${shown.length} 条结果` : `“${query}”：未找到匹配项`);
  else setStatus(`共 ${all.length} 个链接`);
}

async function loadData() {
  setStatus("正在加载 links.json…");
  const res = await fetch(LINKS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`加载失败：${res.status} ${res.statusText}`);
  return await res.json();
}

function initShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        searchInput.focus();
      }
    }

    if (e.key === "Escape") {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
      searchInput.blur();
    }
  });
}

function getQueryParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q") || "";
}

(async () => {
  applyTheme(getPreferredTheme());
  themeToggle.addEventListener("click", () => {
    const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
    searchInput.focus();
  });

  initShortcuts();

  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    setStatus(`加载失败：${err?.message || err}`);
    return;
  }

  const initialQ = getQueryParam();
  searchInput.value = initialQ;
  render(data, initialQ);

  let debounceTimer;
  searchInput.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      render(data, searchInput.value);
      const params = new URLSearchParams(window.location.search);
      if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
      else params.delete("q");
      history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
    }, 80);
  });
})();
