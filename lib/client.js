(() => { const css = ":root {\n  --dsh-autodetect-border: var(--border-color, #ddd);\n  --dsh-autodetect-muted: var(--dsw-alias-label-tertiary, #888);\n}\n\n#dsh-autodetect-styles {\n  display: none;\n}\n\n.dsh-autodetect-editor {\n  min-width: 0;\n  min-height: 0;\n}\n"; if (typeof document !== 'undefined' && !document.getElementById('dsh-autodetect-styles')) { const style = document.createElement('style'); style.id = 'dsh-autodetect-styles'; style.textContent = css; document.head.appendChild(style) } })();
(() => {
  // src/client/conversation.ts
  function appendToConversation(conversation, scope, text) {
    try {
      if (!conversation?.input || !scope || !text) return false;
      const input = conversation.input.for(scope);
      const draft = input.state.getSnapshot().draft ?? "";
      input.setDraft(draft.trim() ? `${draft} ${text}` : text);
      return true;
    } catch (error) {
      console.warn("[dsh-autodetect] \u6DFB\u52A0\u9009\u533A\u5230\u5BF9\u8BDD\u5931\u8D25:", error);
      return false;
    }
  }

  // src/client/index.tsx
  window.__ModuleLoader__.load({
    id: "dsh-autodetect",
    factory: (require2) => {
      const React = require2("react");
      const { createPortal } = require2("react-dom");
      const { useEffect, useLayoutEffect, useMemo, useRef, useState } = React;
      const inject = ["slots", "sidebarRightTabs", "conversation", "sessions"];
      const EXTENSIONS = ["bat", "cmd", "ini", "vbs", "ps1"];
      const style = { position: "relative", display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: "ui-monospace, Consolas, monospace" };
      const editorLayoutStyle = { display: "flex", flex: 1, minHeight: 0, overflow: "hidden", background: "transparent" };
      const gutterStyle = { width: "48px", flex: "0 0 48px", overflow: "hidden", padding: "12px 8px 24px 0", boxSizing: "border-box", textAlign: "right", userSelect: "none", color: "var(--dsw-alias-label-tertiary, #888)", font: "var(--dsw-font-markdown-code-block-small, 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace)", whiteSpace: "pre", lineHeight: "18px" };
      const editorStyle = { flex: 1, width: "0", minHeight: 0, overflow: "auto", boxSizing: "border-box", padding: "12px 16px 24px", outline: 0, background: "transparent", color: "var(--dsw-alias-label-primary, inherit)", font: "var(--dsw-font-markdown-code-block-small, 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace)", lineHeight: "18px", whiteSpace: "pre", overflowWrap: "normal" };
      const barStyle = { display: "flex", gap: "8px", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid var(--border-color, #ddd)", fontFamily: "system-ui, sans-serif", fontSize: "12px" };
      const selectionButtonGap = 10;
      const selectionButtonStyle = { position: "fixed", zIndex: 1e3, padding: "5px 9px", border: "1px solid var(--border-color, #555)", borderRadius: "4px", background: "var(--background-color, #222)", color: "inherit", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap" };
      function relativePath(cwd, path) {
        if (!cwd) return path;
        const base = cwd.replace(/[\\/]+$/, "").replace(/\\/g, "/");
        const full = path.replace(/\\/g, "/");
        return full.toLowerCase().startsWith(`${base.toLowerCase()}/`) ? full.slice(base.length + 1) : path;
      }
      function lineNumber(source, index) {
        return source.slice(0, index).split("\n").length;
      }
      function selectionInsert(path, cwd, source, start, end) {
        const selected = source.slice(start, end);
        const first = lineNumber(source, start);
        const last = lineNumber(source, Math.max(start, end - 1));
        const rel = relativePath(cwd, path);
        const header = last > first ? `${rel}:${first}-${last}` : `${rel}:${first}`;
        return selected.length > 500 ? header : "```" + header + "\n" + selected + "\n```";
      }
      function endpoint(path, scope) {
        const params = new URLSearchParams({ sessionId: scope.sessionId, path });
        if (scope.cwd) params.set("cwd", scope.cwd);
        return `/autodetect/api/read?${params}`;
      }
      function addressInfo(address) {
        try {
          const url = new URL(address);
          const parts = url.pathname.split("/").filter(Boolean);
          if (url.protocol !== "dsh-resource:" || url.hostname !== "file" || parts[0] !== "session" || parts.length < 3) return null;
          const sessionId = decodeURIComponent(parts[1]);
          let path = decodeURIComponent(parts.slice(2).join("/"));
          if (/^\/[A-Za-z]:[\\/]/.test(path)) path = path.slice(1);
          return { sessionId, path };
        } catch {
          return null;
        }
      }
      function titleForAddress(address) {
        const info = addressInfo(address);
        if (!info) return "AutoDetect";
        const parts = info.path.replace(/\\/g, "/").split("/").filter(Boolean);
        return parts[parts.length - 1] || info.path;
      }
      async function load(path, scope, signal) {
        const response = await fetch(endpoint(path, scope), { signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
        return value;
      }
      function AutoDetectView(props) {
        const data = props.customData || {};
        const [content, setContent] = useState(data.content || "");
        const [dirty, setDirty] = useState(false);
        const [saveState, setSaveState] = useState("idle");
        const [selection, setSelection] = useState(null);
        const editorRef = useRef(null);
        const gutterRef = useRef(null);
        const popupRef = useRef(null);
        const selectionButtonRef = useRef(null);
        const lastDragPointRef = useRef(null);
        const lockedMousePointRef = useRef(null);
        const meta = useMemo(() => `${data.encoding || "unknown"}${data.bom ? " + BOM" : ""} \xB7 ${data.newline || "lf"}`, [data]);
        const hideSelection = () => {
          popupRef.current = null;
          setSelection(null);
        };
        const showSelection = (insert, point, anchor = "direct") => {
          const next = {
            insert,
            left: point.left,
            top: point.top,
            anchorLeft: point.left,
            anchorTop: point.top,
            anchor
          };
          popupRef.current = next;
          setSelection(next);
        };
        useLayoutEffect(() => {
          if (!selection) return;
          const rect = selectionButtonRef.current?.getBoundingClientRect();
          if (!rect) return;
          const edge = 8;
          const anchorLeft = selection.anchor === "mouse" ? selection.anchorLeft - rect.width / 2 : selection.anchorLeft;
          const anchorTop = selection.anchor === "mouse" ? selection.anchorTop - rect.height - selectionButtonGap : selection.anchorTop;
          const next = {
            ...selection,
            left: Math.min(Math.max(edge, anchorLeft), Math.max(edge, window.innerWidth - rect.width - edge)),
            top: Math.min(Math.max(edge, anchorTop), Math.max(edge, window.innerHeight - rect.height - edge))
          };
          if (next.left === selection.left && next.top === selection.top) return;
          popupRef.current = next;
          setSelection(next);
        }, [selection?.insert, selection?.anchor, selection?.anchorLeft, selection?.anchorTop]);
        const save = async () => {
          if (saveState === "saving") return;
          setSaveState("saving");
          try {
            const response = await fetch("/autodetect/api/write", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ sessionId: props.scope.sessionId, cwd: props.scope.cwd, path: props.path, content, encoding: data.encoding, bom: data.bom, newline: data.newline, expectedSha256: data.sha256 })
            });
            const value = await response.json();
            if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
            setDirty(false);
            setSaveState("saved");
          } catch (error) {
            setSaveState(`failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        };
        useEffect(() => {
          props.onToolbarState?.({ modes: false, mode: "edit", dirty, editable: !data.binary, saveState: saveState.startsWith("failed") ? "failed" : saveState });
          props.onToolbarControls?.({ setMode: () => {
          }, save });
          return () => props.onToolbarControls?.(null);
        }, [dirty, saveState, data.binary]);
        const updateSelection = (event) => {
          const editor = editorRef.current;
          const browserSelection = window.getSelection();
          if (!editor || !browserSelection || browserSelection.rangeCount === 0 || browserSelection.isCollapsed) {
            hideSelection();
            return;
          }
          const range = browserSelection.getRangeAt(0);
          if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
            hideSelection();
            return;
          }
          const before = document.createRange();
          before.selectNodeContents(editor);
          before.setEnd(range.startContainer, range.startOffset);
          const selected = browserSelection.toString();
          const start = before.toString().length;
          const end = start + selected.length;
          if (!selected.trim()) {
            hideSelection();
            return;
          }
          const rect = range.getBoundingClientRect();
          const hasMousePoint = (event?.type === "mouseup" || event?.type === "mousemove") && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
          const lockedPoint = lockedMousePointRef.current;
          const mousePoint = hasMousePoint || Boolean(lockedPoint);
          const point = mousePoint ? hasMousePoint ? { left: event.clientX, top: event.clientY } : lockedPoint : rect && (rect.width > 0 || rect.height > 0) ? { left: rect.right, top: rect.bottom + 8 } : { left: 12, top: 12 };
          showSelection(selectionInsert(props.path, props.scope?.cwd, content, start, end), point, mousePoint ? "mouse" : "direct");
        };
        const addSelection = () => {
          const current = popupRef.current;
          if (!current) return;
          const ctx = props.ctx;
          const sessionScope = ctx?.sessions?.scope?.(props.scope?.sessionId);
          const conversation = ctx?.conversation || ctx?.get?.("conversation");
          if (appendToConversation(conversation, sessionScope, current.insert)) hideSelection();
        };
        const handleAddSelectionPointerDown = (event) => {
          event.preventDefault();
          event.stopPropagation();
          addSelection();
        };
        useEffect(() => {
          if (!selection) return;
          const close = () => hideSelection();
          const onMouseDown = (event) => {
            if (event.target instanceof Node && selectionButtonRef.current?.contains(event.target)) return;
            close();
          };
          const onKeyDown = (event) => {
            if (event.key === "Escape") close();
          };
          const onSelectionChange = () => {
            const browserSelection = window.getSelection();
            if (!browserSelection || browserSelection.isCollapsed || browserSelection.toString().trim() === "") {
              close();
              return;
            }
            const range = browserSelection.rangeCount > 0 ? browserSelection.getRangeAt(0) : null;
            if (!range || !editorRef.current?.contains(range.startContainer) || !editorRef.current?.contains(range.endContainer)) close();
          };
          const onVisibilityChange = () => {
            if (document.visibilityState !== "visible") close();
          };
          window.addEventListener("mousedown", onMouseDown);
          window.addEventListener("resize", close);
          window.addEventListener("blur", close);
          window.addEventListener("keydown", onKeyDown);
          document.addEventListener("selectionchange", onSelectionChange);
          document.addEventListener("visibilitychange", onVisibilityChange);
          return () => {
            window.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("resize", close);
            window.removeEventListener("blur", close);
            window.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("selectionchange", onSelectionChange);
            document.removeEventListener("visibilitychange", onVisibilityChange);
          };
        }, [selection]);
        useEffect(() => {
          hideSelection();
        }, [props.path, props.scope?.sessionId]);
        const syncGutter = () => {
          if (editorRef.current && gutterRef.current) gutterRef.current.scrollTop = editorRef.current.scrollTop;
          hideSelection();
        };
        const handleMouseMove = (event) => {
          if (!(event.buttons & 1)) return;
          const point = { left: event.clientX, top: event.clientY };
          lastDragPointRef.current = point;
          lockedMousePointRef.current = point;
          updateSelection(event);
        };
        const handleMouseUp = (event) => {
          const lastPoint = lastDragPointRef.current;
          lastDragPointRef.current = null;
          if (lastPoint) {
            lockedMousePointRef.current = lastPoint;
            return;
          }
          updateSelection(event);
        };
        const handleMouseDown = () => {
          lastDragPointRef.current = null;
          lockedMousePointRef.current = null;
        };
        if (data.binary) {
          return React.createElement("div", { style }, React.createElement("div", { style: barStyle }, "AutoDetect \xB7 \u68C0\u6D4B\u4E3A\u4E8C\u8FDB\u5236\u6587\u4EF6\uFF0C\u5DF2\u7981\u7528\u7F16\u8F91"));
        }
        return React.createElement(
          "div",
          { style },
          props.toolbar !== "host" && React.createElement(
            "div",
            { style: barStyle },
            React.createElement("span", null, `AutoDetect \xB7 ${meta}`),
            React.createElement("button", { type: "button", onClick: save, disabled: !dirty || saveState === "saving" }, "\u4FDD\u5B58"),
            saveState === "saved" && React.createElement("span", null, "\u5DF2\u4FDD\u5B58"),
            saveState.startsWith("failed") && React.createElement("span", null, saveState)
          ),
          selection && createPortal(
            React.createElement("button", { ref: selectionButtonRef, type: "button", style: { ...selectionButtonStyle, left: selection.left, top: selection.top }, onPointerDown: handleAddSelectionPointerDown, onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
            } }, "\u6DFB\u52A0\u5230\u5BF9\u8BDD"),
            document.body
          ),
          React.createElement(
            "div",
            { style: editorLayoutStyle },
            React.createElement("div", { ref: gutterRef, "aria-hidden": true, style: gutterStyle }, content.split("\n").map((_, index) => `${index + 1}
`).join("")),
            React.createElement("div", { ref: editorRef, contentEditable: true, suppressContentEditableWarning: true, spellCheck: false, role: "textbox", tabIndex: 0, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onKeyUp: updateSelection, onScroll: syncGutter, onInput: (event) => {
              setContent(event.currentTarget.textContent || "");
              setDirty(true);
              updateSelection(void 0);
            }, style: editorStyle }, content)
          )
        );
      }
      class AutoDetectErrorBoundary extends React.Component {
        constructor(props) {
          super(props);
          this.state = { error: null };
        }
        static getDerivedStateFromError(error) {
          return { error };
        }
        componentDidCatch(error) {
          console.error("[dsh-autodetect] \u6587\u4EF6\u6807\u7B7E\u9875\u6E32\u67D3\u5931\u8D25:", error);
        }
        render() {
          if (this.state.error) {
            return React.createElement("div", { style: { padding: "16px", color: "#c62828", fontFamily: "system-ui, sans-serif", whiteSpace: "pre-wrap" } }, `\u6587\u4EF6\u9884\u89C8\u52A0\u8F7D\u5931\u8D25\uFF1A${this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}`);
          }
          return this.props.children;
        }
      }
      function apply(ctx) {
        function OfficialAutoDetectView(props) {
          const { tab } = props.useTabInfo();
          const address = tab.navigation.address;
          const info = useMemo(() => addressInfo(address), [address]);
          const [state, setState] = useState({ address: null, status: "loading", data: null, error: null });
          useEffect(() => {
            if (!info) {
              setState({ address, status: "error", data: null, error: new Error("\u65E0\u6CD5\u89E3\u6790\u5B98\u65B9\u8D44\u6E90\u5730\u5740") });
              return void 0;
            }
            const controller = new AbortController();
            const onTabAbort = () => controller.abort();
            if (tab.signal.aborted) controller.abort();
            else tab.signal.addEventListener("abort", onTabAbort, { once: true });
            setState({ address, status: "loading", data: null, error: null });
            load(info.path, { sessionId: info.sessionId }, controller.signal).then((data) => {
              if (!controller.signal.aborted) setState({ address, status: "ready", data, error: null });
            }).catch((error) => {
              if (!controller.signal.aborted) setState({ address, status: "error", data: null, error });
            });
            return () => {
              tab.signal.removeEventListener("abort", onTabAbort);
              controller.abort();
            };
          }, [address, info?.path, info?.sessionId, tab.signal]);
          if (state.address !== address || state.status === "loading") return React.createElement("div", { style: { padding: "16px", fontFamily: "system-ui, sans-serif" } }, "\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6\u2026");
          if (state.status === "error") return React.createElement("div", { style: { padding: "16px", color: "#c62828", fontFamily: "system-ui, sans-serif", whiteSpace: "pre-wrap" } }, `\u8BFB\u53D6\u5931\u8D25\uFF1A${state.error instanceof Error ? state.error.message : String(state.error)}`);
          return React.createElement(AutoDetectView, {
            ...props,
            ctx,
            path: info.path,
            scope: { sessionId: info.sessionId },
            customData: state.data,
            toolbar: "host"
          });
        }
        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: "dsh-autodetect",
          kind: "dsh-autodetect",
          patterns: ["dsh-resource://file/**"],
          priority: "extension",
          canOpen: (address) => {
            const info = addressInfo(address);
            if (!info) return false;
            const path = info.path.replace(/\\/g, "/").toLowerCase();
            return EXTENSIONS.some((extension) => path.endsWith(`.${extension}`));
          },
          title: titleForAddress
        }), "dsh-autodetect: tab type");
        ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
          name: "sidebar.right.pane.tab",
          key: "dsh-autodetect"
        }, (props) => React.createElement(AutoDetectErrorBoundary, null, React.createElement(OfficialAutoDetectView, props)))), "dsh-autodetect: tab body");
      }
      return { apply, inject };
    }
  });
})();
