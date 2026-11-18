const AI_NAME = "Maliearn AI";
const AI_IMG = "https://res.cloudinary.com/dqqyvozdw/image/upload/v1795033453/tk8ctyop0xytjmnezmvk.jpg";
const KEY = "maliearn_chats_v1";
const SUGGESTIONS = [
  ["fa-coins", "How can I earn money online in Kenya?"],
  ["fa-robot", "Teach me how to use AI tools for business"],
  ["fa-pen-nib", "Help me write a great article or post"],
  ["fa-graduation-cap", "Explain a school topic to me simply"]
];

const $ = (id) => document.getElementById(id);
const wrap = $("wrap"), chatEl = $("chat"), input = $("input"), sendBtn = $("send");
let chats = [], current = null, loading = false;

try { chats = JSON.parse(localStorage.getItem(KEY)) || []; } catch { chats = []; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch {} };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function avatar(cls = "avatar") {
  const img = new Image();
  img.className = cls; img.alt = AI_NAME; img.src = AI_IMG;
  img.onerror = () => {
    const d = document.createElement("div");
    d.className = "fallback " + cls;
    d.textContent = AI_NAME[0];
    img.replaceWith(d);
  };
  return img;
}

/* ---------- Formatting ---------- */
function format(text) {
  const blocks = [];
  let s = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    blocks.push({ lang, code: code.replace(/\n$/, "") });
    return "\n\u0000" + (blocks.length - 1) + "\u0000\n";
  });
  s = esc(s)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/[^\s<)]+[^\s<).,!?])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  let html = "", list = null, para = [];
  const flushP = () => { if (para.length) { html += "<p>" + para.join("<br>") + "</p>"; para = []; } };
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of s.split("\n")) {
    const line = raw.trim();
    let m;
    if (!line) { flushP(); closeList(); continue; }
    if ((m = line.match(/^\u0000(\d+)\u0000$/))) {
      flushP(); closeList();
      const b = blocks[+m[1]];
      html += `<div class="code"><div class="code-h"><span>${esc(b.lang || "code")}</span><button class="copy-code"><i class="fa-regular fa-copy"></i> Copy code</button></div><pre><code>${esc(b.code)}</code></pre></div>`;
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushP(); closeList(); html += `<h${m[1].length}>${m[2]}</h${m[1].length}>`;
    } else if ((m = line.match(/^[-*•]\s+(.*)$/))) {
      flushP(); if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; } html += `<li>${m[1]}</li>`;
    } else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
      flushP(); if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; } html += `<li>${m[1]}</li>`;
    } else { closeList(); para.push(line); }
  }
  flushP(); closeList();
  return html;
}

/* ---------- Rendering ---------- */
function scrollDown() { chatEl.scrollTop = chatEl.scrollHeight; }

function renderWelcome() {
  const w = document.createElement("div");
  w.id = "welcome";
  const a = avatar("avatar big");
  w.appendChild(a);
  w.insertAdjacentHTML("beforeend", `<h1>Hello! I'm ${AI_NAME} 👋</h1>
    <p>Your AI friend from Maliearn. Ask me anything: school, business, code, life, money. I'll keep it simple, bro.</p>
    <div class="cards"></div>`);
  const cards = w.querySelector(".cards");
  SUGGESTIONS.forEach(([ic, t]) => {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = `<i class="fa-solid ${ic}"></i>${esc(t)}`;
    b.onclick = () => send(t);
    cards.appendChild(b);
  });
  wrap.appendChild(w);
}

function addMessage(m, idx, errorStyle) {
  const row = document.createElement("div");
  row.className = "msg " + (m.role === "user" ? "user" : "ai") + (errorStyle ? " err" : "");
  if (m.role === "user") {
    row.innerHTML = `<div class="body"><div class="bubble">${esc(m.content)}</div></div>`;
  } else {
    row.appendChild(avatar());
    const body = document.createElement("div");
    body.className = "body";
    body.innerHTML = `<div class="bubble">${errorStyle ? esc(m.content) : format(m.content)}</div>`;
    if (!errorStyle) {
      const bar = document.createElement("div");
      bar.className = "actions";
      bar.innerHTML = `<button class="copy" title="Copy"><i class="fa-regular fa-copy"></i></button>
        <span class="time">${fmtTime(m.ts)}</span>
        <button class="fb up" title="Good"><i class="fa-regular fa-thumbs-up"></i></button>
        <button class="fb down" title="Bad"><i class="fa-regular fa-thumbs-down"></i></button>`;
      const up = bar.querySelector(".up"), down = bar.querySelector(".down");
      const paint = () => {
        up.classList.toggle("on", m.fb === "up"); down.classList.toggle("on", m.fb === "down");
        up.firstChild.className = m.fb === "up" ? "fa-solid fa-thumbs-up" : "fa-regular fa-thumbs-up";
        down.firstChild.className = m.fb === "down" ? "fa-solid fa-thumbs-down" : "fa-regular fa-thumbs-down";
      };
      paint();
      up.onclick = () => { m.fb = m.fb === "up" ? null : "up"; paint(); save(); };
      down.onclick = () => { m.fb = m.fb === "down" ? null : "down"; paint(); save(); };
      const cp = bar.querySelector(".copy");
      cp.onclick = () => copy(m.content, cp, '<i class="fa-regular fa-copy"></i>', '<i class="fa-solid fa-check"></i> Copied');
      body.appendChild(bar);
    }
    row.appendChild(body);
  }
  wrap.appendChild(row);
  return row;
}

function copy(text, btn, normal, done) {
  const finish = () => { btn.innerHTML = done; setTimeout(() => (btn.innerHTML = normal), 1500); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(finish).catch(() => {});
  else { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); finish(); }
}

wrap.addEventListener("click", (e) => {
  const b = e.target.closest(".copy-code");
  if (!b) return;
  const code = b.closest(".code").querySelector("code").textContent;
  copy(code, b, '<i class="fa-regular fa-copy"></i> Copy code', '<i class="fa-solid fa-check"></i> Copied');
});

function renderChat() {
  wrap.innerHTML = "";
  const c = chats.find((x) => x.id === current);
  if (!c || !c.messages.length) renderWelcome();
  else c.messages.forEach((m, i) => addMessage(m, i));
  renderList();
  scrollDown();
}

function renderList() {
  const list = $("chatList");
  list.innerHTML = "";
  chats.forEach((c) => {
    const d = document.createElement("div");
    d.className = "chat-item" + (c.id === current ? " active" : "");
    d.innerHTML = `<i class="fa-regular fa-message"></i><span>${esc(c.title)}</span><button class="del" title="Delete"><i class="fa-solid fa-trash"></i></button>`;
    d.onclick = () => { if (loading) return; current = c.id; renderChat(); closeSide(); };
    d.querySelector(".del").onclick = (e) => {
      e.stopPropagation();
      if (loading) return;
      chats = chats.filter((x) => x.id !== c.id);
      if (current === c.id) current = chats[0] ? chats[0].id : null;
      save(); renderChat();
    };
    list.appendChild(d);
  });
}

/* ---------- Sending ---------- */
async function send(text) {
  text = (text || "").trim();
  if (!text || loading) return;
  let c = chats.find((x) => x.id === current);
  if (!c) {
    c = { id: uid(), title: text.slice(0, 40), messages: [] };
    chats.unshift(c); current = c.id;
  }
  const w = $("welcome"); if (w) w.remove();
  const um = { role: "user", content: text, ts: Date.now() };
  c.messages.push(um); save(); renderList();
  addMessage(um);
  input.value = ""; autoGrow(); update();

  loading = true; update();
  const typing = document.createElement("div");
  typing.className = "msg ai";
  typing.appendChild(avatar());
  typing.insertAdjacentHTML("beforeend", '<div class="body"><div class="typing"><span></span><span></span><span></span></div></div>');
  wrap.appendChild(typing); scrollDown();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: c.messages.map(({ role, content }) => ({ role, content })) })
    });
    const data = await res.json().catch(() => ({}));
    typing.remove();
    if (!res.ok || !data.reply) throw new Error(data.error || "Request failed");
    const am = { role: "assistant", content: data.reply, ts: Date.now(), fb: null };
    c.messages.push(am); save();
    addMessage(am);
  } catch (err) {
    typing.remove();
    addMessage({ role: "assistant", content: "Eish bro, something went wrong. Check your network and try again. (" + err.message + ")" }, 0, true);
  }
  loading = false; update(); scrollDown(); input.focus();
}

/* ---------- UI wiring ---------- */
function update() { sendBtn.disabled = loading || !input.value.trim(); }
function autoGrow() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 160) + "px"; }
function closeSide() { document.body.classList.remove("open"); }

input.addEventListener("input", () => { autoGrow(); update(); });
input.addEventListener("keydown", (e) => {
  const mobile = window.matchMedia("(max-width:800px)").matches;
  if (e.key === "Enter" && !e.shiftKey && !mobile) { e.preventDefault(); send(input.value); }
});
sendBtn.onclick = () => send(input.value);
$("newChat").onclick = () => { if (loading) return; current = null; renderChat(); closeSide(); input.focus(); };
$("menuBtn").onclick = () => document.body.classList.add("open");
$("overlay").onclick = closeSide;

$("topAvatar").replaceWith(avatar());
current = chats[0] ? chats[0].id : null;
renderChat();
update();
