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

// ✅ singleton client (prevents re-init churn)
const supabase = (() => {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
return createClient(url, key);
})();

function shortId(id: string | null) {
if (!id) return "null";
return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function ThreadView() {
const params = useParams();
const rawId = typeof params?.id === "string" ? params.id : "";
const conversationId = useMemo(() => Number.parseInt(rawId, 10), [rawId]);

const [msgs, setMsgs] = useState<MsgRow[]>([]);
const [text, setText] = useState("");
const [status, setStatus] = useState<string>("");
const [loading, setLoading] = useState(true);

const [myUserId, setMyUserId] = useState<string | null>(null);

const bottomRef = useRef<HTMLDivElement | null>(null);

// prevents spamming "mark read" writes
const lastMarkedReadRef = useRef<number>(0);
const markReadInFlightRef = useRef(false);

// prevents duplicate appends from realtime + send
const seenIdsRef = useRef<Set<number>>(new Set());

function scrollToBottom() {
requestAnimationFrame(() =>
bottomRef.current?.scrollIntoView({ behavior: "smooth" })
);
}

async function getUid(): Promise<string | null> {
const { data, error } = await supabase.auth.getSession();
if (error) {
setMyUserId(null);
return null;
}
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function signOut() {
setStatus("");
const { error } = await supabase.auth.signOut();
if (error) {
setStatus(`Sign out error: ${error.message}`);
return;
}
setMyUserId(null);
setStatus("Signed out. Now sign in as the other user in this window.");
}

async function markThreadRead(uid: string, latestMessageId: number) {
if (!Number.isFinite(conversationId)) return;
if (!uid) return;
if (!latestMessageId || latestMessageId <= 0) return;

// Don't write repeatedly
if (latestMessageId <= lastMarkedReadRef.current) return;
if (markReadInFlightRef.current) return;

// Only mark read when tab is visible (prevents background reads)
if (document.visibilityState !== "visible") return;

markReadInFlightRef.current = true;

const { error } = await supabase.from("conversation_reads").upsert(
{
conversation_id: conversationId,
user_id: uid,
last_read_message_id: latestMessageId,
updated_at: new Date().toISOString(),
},
{ onConflict: "conversation_id,user_id" }
);

markReadInFlightRef.current = false;

if (!error) {
lastMarkedReadRef.current = latestMessageId;
}
}

async function loadMessages(opts?: { silent?: boolean }) {
const silent = opts?.silent ?? false;
if (!Number.isFinite(conversationId)) {
setStatus("Bad conversation id in URL.");
setLoading(false);
return;
}

if (!silent) setLoading(true);

const uid = await getUid(); // ✅ always resolve uid first

const { data, error } = await supabase
.from("messages")
.select("id, conversation_id, sender_id, body, created_at")
.eq("conversation_id", conversationId)
.order("created_at", { ascending: true });

if (!silent) setLoading(false);

if (error) {
setStatus(`Load error: ${error.message}`);
return;
}

setStatus("");

const rows = (data ?? []) as MsgRow[];

// rebuild seen set
const s = new Set<number>();
for (const r of rows) s.add(r.id);
seenIdsRef.current = s;

setMsgs(rows);

const lastId = rows.length ? rows[rows.length - 1].id : 0;
if (uid && lastId > 0) void markThreadRead(uid, lastId);

scrollToBottom();
}

function appendMessage(m: MsgRow) {
if (!m?.id) return;

// ✅ dedupe
if (seenIdsRef.current.has(m.id)) return;
seenIdsRef.current.add(m.id);

setMsgs((prev) => {
const next = [...prev, m];
next.sort(
(a, b) =>
new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
);
return next;
});

// Mark read only if tab is visible AND we know uid
if (document.visibilityState === "visible") {
const uid = myUserId; // ok here because it’s just a best-effort mark read
if (uid) void markThreadRead(uid, m.id);
}

scrollToBottom();
}

async function sendMessage() {
const trimmed = text.trim();
if (!trimmed) return;

if (!Number.isFinite(conversationId)) {
setStatus("Bad conversation id in URL.");
return;
}

const uid = await getUid();
if (!uid) {
setStatus("Not signed in in this window. Sign in before sending.");
return;
}

setStatus("");

// ✅ return inserted row so we can append immediately
const { data, error } = await supabase
.from("messages")
.insert({
conversation_id: conversationId,
sender_id: uid,
body: trimmed,
})
.select("id, conversation_id, sender_id, body, created_at")
.single();

if (error) {
setStatus(`Send error: ${error.message}`);
return;
}

setText("");

if (data) {
appendMessage(data as MsgRow);
// sender should not see their own as unread
void markThreadRead(uid, (data as MsgRow).id);
}
}

// Keep auth state synced
useEffect(() => {
void getUid();
const { data: sub } = supabase.auth.onAuthStateChange(() => {
void getUid();
});
return () => sub.subscription.unsubscribe();
}, []);

// Initial load + REALTIME subscription (no polling)
useEffect(() => {
if (!Number.isFinite(conversationId)) return;

void loadMessages({ silent: false });

const channel = supabase
.channel(`messages:${conversationId}`)
.on(
"postgres_changes",
{
event: "INSERT",
schema: "public",
table: "messages",
filter: `conversation_id=eq.${conversationId}`,
},
(payload) => {
const m = payload.new as MsgRow;
appendMessage(m);
}
)
.subscribe();

const onFocus = () => void loadMessages({ silent: true });
const onVis = () => {
if (document.visibilityState === "visible") void loadMessages({ silent: true });
};

window.addEventListener("focus", onFocus);
document.addEventListener("visibilitychange", onVis);

return () => {
window.removeEventListener("focus", onFocus);
document.removeEventListener("visibilitychange", onVis);
void supabase.removeChannel(channel);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [conversationId]);

return (
<div style={{ padding: "18px 14px", maxWidth: 720, margin: "0 auto" }}>
{/* AUTH BAR */}
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
marginBottom: 12,
padding: "10px 12px",
borderRadius: 12,
border: "1px solid rgba(185,110,255,0.35)",
background: "rgba(155,60,255,0.10)",
}}
>
<div style={{ fontSize: 12, color: "rgba(255,255,255,0.88)" }}>
ME: <b style={{ color: "#ffd1ff" }}>{shortId(myUserId)}</b>
</div>

<div style={{ display: "flex", gap: 8 }}>
<button
onClick={() => void getUid()}
style={{
padding: "9px 12px",
borderRadius: 12,
border: "1px solid rgba(185, 110, 255, 0.55)",
background: "rgba(155, 60, 255, 0.14)",
color: "white",
cursor: "pointer",
fontWeight: 700,
}}
>
Refresh
</button>

<button
onClick={signOut}
style={{
padding: "9px 12px",
borderRadius: 12,
border: "1px solid rgba(255, 120, 120, 0.45)",
background: "rgba(255, 80, 80, 0.12)",
color: "white",
cursor: "pointer",
fontWeight: 700,
}}
>
Sign out
</button>
</div>
</div>

<div style={{ opacity: 0.8, marginBottom: 10 }}>
Conversation <b>#{Number.isFinite(conversationId) ? conversationId : "?"}</b>
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
const mine = !!myUserId && !!m.sender_id && m.sender_id === myUserId;

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
? "rgba(185, 110, 255, 0.30)"
: "rgba(90, 25, 170, 0.22)",
boxShadow: mine
? "0 0 24px rgba(185,110,255,0.28)"
: "0 0 18px rgba(185,110,255,0.18)",
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
if (e.key === "Enter") void sendMessage();
}}
/>

<button
onClick={() => void sendMessage()}
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

{status ? <div style={{ marginTop: 10, color: "#ffb3b3" }}>{status}</div> : null}
</div>
);
}