"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Msg = {
id: string;
conversation_id: number; // int8
sender_id: string;
body: string;
created_at: string;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
return createClient(url, key);
}

function formatSupabaseError(e: any) {
// Supabase errors often have: message, details, hint, code
if (!e) return "Unknown error";
if (typeof e === "string") return e;

const parts = [
e.message ? `message: ${e.message}` : null,
e.details ? `details: ${e.details}` : null,
e.hint ? `hint: ${e.hint}` : null,
e.code ? `code: ${e.code}` : null,
].filter(Boolean);

return parts.length ? parts.join(" | ") : JSON.stringify(e);
}

export default function ThreadView() {
const supabase = useMemo(() => getSupabase(), []);
const params = useParams();

// /messages/[id] where id is your conversation_id (int8)
const rawId = typeof params?.id === "string" ? params.id : "";
const conversationId = useMemo(() => {
if (!rawId) return null;
const n = Number(rawId);
return Number.isFinite(n) ? n : null;
}, [rawId]);

const [myId, setMyId] = useState<string | null>(null);
const [items, setItems] = useState<Msg[]>([]);
const [text, setText] = useState("");
const [busy, setBusy] = useState(false);
const [err, setErr] = useState("");

useEffect(() => {
let alive = true;

(async () => {
try {
const { data, error } = await supabase.auth.getUser();
if (!alive) return;
if (error) throw error;
setMyId(data?.user?.id ?? null);
} catch (e) {
if (!alive) return;
setMyId(null);
}
})();

return () => {
alive = false;
};
}, [supabase]);

async function load() {
if (conversationId === null) {
setItems([]);
setErr("Invalid conversation id in the URL.");
return;
}

try {
setErr("");

const { data, error } = await supabase
.from("messages")
.select("id,conversation_id,sender_id,body,created_at")
.eq("conversation_id", conversationId)
.order("created_at", { ascending: true })
.limit(200);

if (error) throw error;

setItems((data ?? []) as Msg[]);
} catch (e: any) {
setErr(formatSupabaseError(e));
}
}

useEffect(() => {
load();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [conversationId]);

async function send() {
if (conversationId === null) {
setErr("Invalid conversation id in the URL.");
return;
}
if (!text.trim()) return;

try {
setBusy(true);
setErr("");

const { data: authData, error: authErr } = await supabase.auth.getUser();
if (authErr) throw authErr;

const user = authData?.user;
if (!user) {
setErr("You are not logged in.");
return;
}

const payload = {
conversation_id: conversationId, // ✅ int8 number
sender_id: user.id,
body: text.trim(),
};

console.log("INSERT payload:", payload);

const { data, error } = await supabase
.from("messages")
.insert(payload)
.select("id,conversation_id,sender_id,body,created_at");

console.log("INSERT data:", data);
console.log("INSERT error:", error);

if (error) throw error;

setText("");
await load();
} catch (e: any) {
// If the error is coming from PostgREST, this will show the real reason
setErr(formatSupabaseError(e));
} finally {
setBusy(false);
}
}

return (
<div
style={{
maxWidth: 780,
margin: "0 auto",
padding: "10px 0",
position: "relative",
zIndex: 60,
}}
>
<div
style={{
color: "rgba(255,255,255,0.9)",
fontWeight: 800,
marginBottom: 10,
}}
>
THREAD VIEW ACTIVE
<div style={{ opacity: 0.85, marginTop: 4 }}>
Conversation {conversationId ?? "?"}
</div>
</div>

<div
style={{
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(0,0,0,0.55)",
borderRadius: 18,
padding: 14,
minHeight: 420,
display: "flex",
flexDirection: "column",
gap: 10,
}}
>
<div style={{ flex: 1, overflow: "auto", paddingRight: 4 }}>
{items.length ? (
items.map((m) => {
const mine = myId && m.sender_id === myId;
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
padding: "10px 12px",
borderRadius: 14,
border: "1px solid rgba(168,85,247,0.28)",
background: mine
? "rgba(168,85,247,0.18)"
: "rgba(0,0,0,0.35)",
color: "rgba(255,255,255,0.92)",
whiteSpace: "pre-wrap",
}}
>
{m.body}
<div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
{new Date(m.created_at).toLocaleString()}
</div>
</div>
</div>
);
})
) : (
<div style={{ opacity: 0.7 }}>No messages yet.</div>
)}
</div>

<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
<input
value={text}
onChange={(e) => setText(e.target.value)}
placeholder="Message…"
disabled={busy}
style={{
flex: 1,
padding: "10px 12px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.35)",
color: "white",
outline: "none",
}}
/>
<button
type="button"
onClick={send}
disabled={busy || !text.trim()}
style={{
padding: "10px 14px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.45)",
background: "rgba(168,85,247,0.18)",
color: "rgba(255,255,255,0.95)",
fontWeight: 800,
cursor: busy || !text.trim() ? "not-allowed" : "pointer",
opacity: busy || !text.trim() ? 0.55 : 1,
}}
>
Send
</button>
</div>

{err ? (
<div style={{ opacity: 0.9, color: "#ffd1ff", whiteSpace: "pre-wrap" }}>
{err}
</div>
) : null}
</div>
</div>
);
}