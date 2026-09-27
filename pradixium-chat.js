/* PRADIXIUM™ — AI Chat Assistant widget
 * Self-contained: injects its own styles/DOM, one <script src="/pradixium-chat.js"></script>
 * drops it onto any page. Talks to /api/chat, which only ever answers
 * from real Pradixium data — see that file's own comment for the full
 * honesty discipline. This widget itself does no data handling beyond
 * passing the conversation back and forth.
 */
(function () {
  "use strict";

  const STYLE = `
#pxChatBubble{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:#2463f5;color:#fff;border:0;cursor:pointer;box-shadow:0 8px 24px rgba(36,99,245,.35);font-size:24px;z-index:9998;display:flex;align-items:center;justify-content:center}
#pxChatBubble:hover{background:#1d54d6}
#pxChatPanel{position:fixed;right:20px;bottom:86px;width:340px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 140px);background:#fff;border:1px solid #e5eaf0;border-radius:16px;box-shadow:0 20px 60px rgba(15,31,52,.22);display:none;flex-direction:column;overflow:hidden;z-index:9999;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
#pxChatPanel.open{display:flex}
#pxChatHead{background:#172131;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
#pxChatHead .t{font-weight:700;font-size:14px}
#pxChatHead .s{font-size:11px;color:#9aa8bd;margin-top:1px}
#pxChatClose{background:transparent;border:0;color:#9aa8bd;cursor:pointer;font-size:18px;line-height:1;padding:2px 4px}
#pxChatBody{flex:1;overflow-y:auto;padding:14px 14px 6px;background:#f9fafb}
.pxMsg{margin-bottom:10px;font-size:13px;line-height:1.5;max-width:88%}
.pxMsg.user{margin-left:auto;background:#2463f5;color:#fff;border-radius:12px 12px 2px 12px;padding:9px 12px}
.pxMsg.bot{margin-right:auto;background:#fff;border:1px solid #e5eaf0;color:#172131;border-radius:12px 12px 12px 2px;padding:9px 12px}
.pxMsg.error{color:#b34747;background:#fdecec;border:1px solid #f5c6c6}
#pxChatForm{display:flex;gap:8px;padding:10px;border-top:1px solid #eef1f4;background:#fff}
#pxChatInput{flex:1;border:1px solid #d7dee6;border-radius:20px;padding:9px 14px;font-size:13px;font-family:inherit;outline:none}
#pxChatInput:focus{border-color:#2463f5}
#pxChatSend{background:#2463f5;color:#fff;border:0;border-radius:20px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer}
#pxChatSend:disabled{opacity:.5;cursor:default}
#pxChatTyping{font-size:12px;color:#8792a1;padding:0 14px 8px;display:none}
`;

  function injectStyle() {
    const el = document.createElement("style");
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function buildDom() {
    const bubble = el("button", { id: "pxChatBubble", "aria-label": "Chat with Pradixium Assistant", type: "button" });
    bubble.textContent = "💬";

    const panel = el("div", { id: "pxChatPanel" });
    const head = el("div", { id: "pxChatHead" }, [
      el("div", {}, [
        el("div", { class: "t", text: "Pradixium Assistant" }),
        el("div", { class: "s", text: "Ask about our real, sourced country data" })
      ]),
      el("button", { id: "pxChatClose", type: "button", "aria-label": "Close chat", text: "×" })
    ]);
    const body = el("div", { id: "pxChatBody" });
    const typing = el("div", { id: "pxChatTyping", text: "Thinking…" });
    const form = el("form", { id: "pxChatForm" }, [
      el("input", { id: "pxChatInput", type: "text", placeholder: "e.g. Can foreigners buy in Greece?", autocomplete: "off" }),
      el("button", { id: "pxChatSend", type: "submit", text: "Send" })
    ]);

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(typing);
    panel.appendChild(form);

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    return { bubble, panel, body, typing, form };
  }

  function addMessage(body, role, text) {
    const msg = document.createElement("div");
    msg.className = "pxMsg " + role;
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function init() {
    injectStyle();
    const { bubble, panel, body, typing, form } = buildDom();
    const input = form.querySelector("#pxChatInput");
    const sendBtn = form.querySelector("#pxChatSend");
    const closeBtn = panel.querySelector("#pxChatClose");

    const history = [];
    let opened = false;

    bubble.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (!opened) {
        opened = true;
        addMessage(body, "bot", "Hi! I'm the Pradixium Assistant. Ask me about foreign-buyer rules, closing costs, or which markets currently look most attractive — I only answer from Pradixium's real, sourced data.");
      }
      if (panel.classList.contains("open")) input.focus();
    });
    closeBtn.addEventListener("click", () => panel.classList.remove("open"));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMessage(body, "user", text);
      history.push({ role: "user", content: text });
      input.value = "";
      input.disabled = true;
      sendBtn.disabled = true;
      typing.style.display = "block";

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal
        });
        clearTimeout(timer);
        const json = await r.json().catch(() => null);
        if (json && json.success) {
          addMessage(body, "bot", json.reply);
          history.push({ role: "assistant", content: json.reply });
        } else {
          addMessage(body, "error", (json && json.error) || "Something went wrong — please try again.");
        }
      } catch (err) {
        addMessage(body, "error", "Could not reach the chat assistant — please try again shortly.");
      } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        typing.style.display = "none";
        input.focus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
