"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type MsgRow = {
id: number;
conversation_id: number;
sender_id: string | null;
body: string | null;
created_at: string;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
return createClient(url, key);
}

export default function ThreadView() {
const supabase = useMemo(() => getSupabase(), []);
const params = useParams();

const rawId = typeof params?.id === "string" ? params.id : "";
const conversationId = Number.parseInt(rawId, 10);

const [msgs, setMsgs] = useState<MsgRow[]>([]);
const [text, setText] = useState("");
const [status, setStatus] = useState<string>("");
const [loading, setLoading] = useState(true); // first load only
const bottomRef = useRef<HTMLDivElement | null>(null);

const inFlightRef = useRef(false);
const lastTopIdRef = useRef<number>(0);
const lastSigRef = useRef<string>("");

function scrollToBottom() {
requestAnimationFrame(() =>
bottomRef.current?.scrollIntoView({ behavior: "smooth" })
);
}

async function loadMessages(opts?: { silent?: boolean }) {
const silent = opts?.silent ?? false;
if (!Number.isFinite(conversationId)) return;
if (inFlightRef.current) return;

inFlightRef.current = true;
if (!silent) setLoading(true);

const { data, error } = await supabase
.from("messages")
.select("id, conversation_id, sender_id, body, created_at")
.eq("conversation_id", conversationId)
.order("created_at", { ascending: true });

inFlightRef.current = false;
if (!silent) setLoading(false);

if (error) {
setStatus(`Load error: ${error.message}`);
return;
}

setStatus("");

const rows = (data ?? []) as MsgRow[];

// signature avoids pointless rerenders
const sig = rows.map((m) => `${m.id}:${m.created_at}:${m.body ?? ""}`).join("|");
if (sig !== lastSigRef.current) {
lastSigRef.current = sig;
setMsgs(rows);
// track latest message id so our checker is cheap
const lastId = rows.length ? rows[rows.length - 1].id : 0;
lastTopIdRef.current = lastId;
scrollToBottom();
}
}

// Cheap “is there anything new?” check
async function checkForNew() {
if (!Number.isFinite(conversationId)) return;
if (document.visibilityState !== "visible") return; // don’t spam in background
if (inFlightRef.current) return;

const { data, error } = await supabase
.from("messages")
.select("id")
.eq("conversation_id", conversationId)
.order("id", { ascending: false })
.limit(1);

if (error) return;

const newestId = data?.[0]?.id ?? 0;
if (newestId && newestId !== lastTopIdRef.current) {
await loadMessages({ silent: true });
}
}

async function sendMessage() {
const trimmed = text.trim();
if (!trimmed) return;

if (!Number.isFinite(conversationId)) {
setStatus("Bad conversation id in URL.");
return;
}

setStatus("");

const { error } = await supabase.from("messages").insert({
conversation_id: conversationId,
sender_id: null, // still nullable until auth is wired
body: trimmed,
});

if (error) {
setStatus(`Send error: ${error.message}`);
return;
}

setText("");
// refresh immediately for the sender
await loadMessages({ silent: true });
}

useEffect(() => {
if (!Number.isFinite(conversationId)) return;

// first load
loadMessages({ silent: false });

// silent “new message” checker
const t = window.setInterval(() => {
checkForNew();
}, 1200); // ~1.2s feels instant without looking like it’s “refreshing”

// also refresh when user comes back to the tab
const onFocus = () => checkForNew();
const onVis = () => {
if (document.visibilityState === "visible") checkForNew();
};

window.addEventListener("focus", onFocus);
document.addEventListener("visibilitychange", onVis);

return () => {
window.clearInterval(t);
window.removeEventListener("focus", onFocus);
document.removeEventListener("visibilitychange", onVis);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [conversationId]);

return (
<div style={{ padding: "18px 14px", maxWidth: 720, margin: "0 auto" }}>
<div style={{ opacity: 0.8, marginBottom: 10 }}>
Conversation{" "}
<b>#{Number.isFinite(conversationId) ? conversationId : "?"}</b>
</div>

<div
style={{
border: "1px solid rgba(255,255,255,0.12)",
borderRadius: 14,
padding: 12,
minHeight: 420,
background: "rgba(0,0,0,0.35)",
overflow: "auto",
}}
>
{loading ? (
<div style={{ opacity: 0.7 }}>Loading…</div>
) : msgs.length === 0 ? (
<div style={{ opacity: 0.7 }}>No messages yet.</div>
) : (
msgs.map((m) => {
const mine = false; // when auth is wired: m.sender_id === user.id
return (
<div
key={m.id}
style={{
display: "flex",
justifyContent: mine ? "flex-end" : "flex-start",
marginBottom: 10,
}}
>
<div
style={{
maxWidth: "78%",
padding: "10px 14px",
borderRadius: 18,
border: "1px solid rgba(185, 110, 255, 0.55)",
background: mine
? "rgba(155, 60, 255, 0.28)"
: "rgba(90, 25, 170, 0.22)",
boxShadow: "0 0 18px rgba(185,110,255,0.18)",
color: "rgba(255,255,255,0.95)",
lineHeight: 1.35,
}}
>
<div style={{ fontSize: 15 }}>{m.body ?? ""}</div>
<div style={{ marginTop: 6, fontSize: 11, opacity: 0.6 }}>
{new Date(m.created_at).toLocaleString()}
</div>
</div>
</div>
);
})
)}

<div ref={bottomRef} />
</div>

<div style={{ display: "flex", gap: 10, marginTop: 12 }}>
<input
value={text}
onChange={(e) => setText(e.target.value)}
placeholder="Write a message…"
style={{
flex: 1,
padding: "12px 12px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.35)",
color: "white",
outline: "none",
}}
onKeyDown={(e) => {
if (e.key === "Enter") sendMessage();
}}
/>

<button
onClick={sendMessage}
style={{
padding: "12px 16px",
borderRadius: 12,
border: "1px solid rgba(185, 110, 255, 0.65)",
background: "rgba(155, 60, 255, 0.20)",
color: "white",
cursor: "pointer",
fontWeight: 700,
}}
>
Send
</button>
</div>

{status ? (
<div style={{ marginTop: 10, color: "#ffb3b3" }}>{status}</div>
) : null}
</div>
);
}