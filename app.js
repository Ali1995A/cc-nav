const LINKS_URL = "./links.json";
const STORAGE = {
  theme: "cc-nav:theme",
};

const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearch");
const themeToggle = document.getElementById("themeToggle");
let activeCategory = "全部";

function removeInjectedRotateTip() {
  const target = "请横屏使用";
  if (!document.body || !document.body.textContent?.includes(target)) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node?.nodeValue && node.nodeValue.includes(target)) hits.push(node);
  }

  for (const node of hits) {
    const el = node.parentElement;
    if (el && el.childNodes.length === 1 && el.textContent?.trim() === target) el.remove();
    else node.nodeValue = node.nodeValue.replaceAll(target, "");
  }
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

function normalize(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

function getPreferredTheme() {
  let saved;
  try { saved = localStorage.getItem(STORAGE.theme); } catch {}
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(STORAGE.theme, theme); } catch {}
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

function normalizePinyin(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  // Use NFD so tone marks are combining characters. Then force "a" -> "ɑ" (open a, U+0251).
  return s.normalize("NFD").replaceAll("a", "ɑ");
}

function getPos(item) {
  const pos = item?.pos;
  if (!Array.isArray(pos) || pos.length < 2) return null;

  const row = Number(pos[0]);
  const col = Number(pos[1]);
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1) return null;
  return { row, col };
}

function render({ title, items, groups = [] }, query) {
  document.title = title ? `${title}` : "CC 导航";
  const q = normalize(query);

  const all = (Array.isArray(items) ? items : []).filter(it => it && typeof it.url === "string" && /^https?:\/\//i.test(it.url));
  const categoryFor = it => groups.find(g => g.items.includes(it.title))?.title || "其他探索";
  const shown = all.filter(it => (activeCategory === "全部" || categoryFor(it) === activeCategory) && (!q || normalize(toTextForSearch(it) + " " + categoryFor(it)).includes(q)));
  const categories = [...new Set([...groups.map(g => g.title), ...all.map(categoryFor)])];
  const nav = document.getElementById("categories");
  nav.replaceChildren();
  for (const name of ["全部", ...categories]) {
    const count = all.filter(it => name === "全部" || categoryFor(it) === name).length;
    const button = makeEl("button", { type: "button", class: "category-btn", "aria-pressed": String(name === activeCategory), text: `${name} · ${count}` });
    button.addEventListener("click", () => {
      activeCategory = name;
      render({ title, items, groups }, searchInput.value);
      [...nav.children].find(el => el.textContent === button.textContent)?.focus();
    });
    nav.append(button);
  }

  gridEl.replaceChildren();
  const sections = new Map();
  for (const name of categories) {
    const count = shown.filter(it => categoryFor(it) === name).length;
    if (!count) continue;
    const cards = makeEl("div", { class: "category-grid" });
    gridEl.append(makeEl("section", { class: "category-section", "aria-label": name }, [makeEl("h2", { text: `${name} · ${count}` }), cards]));
    sections.set(name, cards);
  }
  for (const item of shown) {
    const host = formatHost(item.url);
    const meta = host;
    const titleRow = makeEl("div", { class: "card__top" }, [
      makeEl("div", { class: "card__title", text: item.title || "未命名" }),
      makeEl("div", { class: "card__meta", text: meta }),
    ]);

    const desc = item.desc ? makeEl("div", { class: "card__desc", text: item.desc }) : null;
    const pinyin = item.pinyin ? makeEl("div", { class: "card__pinyin pinyin-text", text: normalizePinyin(item.pinyin) }) : null;
    const tags = Array.isArray(item.tags) && item.tags.length
      ? makeEl(
          "div",
          { class: "tags" },
          item.tags.slice(0, 8).map((t) => makeEl("span", { class: "tag", text: String(t) })),
        )
      : null;

    const infoChildren = [titleRow];
    if (pinyin) infoChildren.push(pinyin);
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

    sections.get(categoryFor(item)).append(a);
  }

  if (q) setStatus(shown.length ? `“${query}”：共 ${shown.length} 条结果` : `“${query}”：未找到匹配项`);
  else setStatus(`${activeCategory} · 共 ${shown.length} 个链接`);
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
  removeInjectedRotateTip();

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
