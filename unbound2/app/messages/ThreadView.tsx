"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Msg = {
id: string;
thread_id: string;
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

export default function ThreadView() {
const supabase = useMemo(() => getSupabase(), []);
const params = useParams();
const threadId = typeof params?.id === "string" ? params.id : "";

const [myId, setMyId] = useState<string | null>(null);
const [items, setItems] = useState<Msg[]>([]);
const [text, setText] = useState("");
const [busy, setBusy] = useState(false);
const [err, setErr] = useState("");

useEffect(() => {
let alive = true;

(async () => {
try {
const { data } = await supabase.auth.getUser();
if (!alive) return;
setMyId(data?.user?.id ?? null);
} catch {
// ignore
}
})();

return () => {
alive = false;
};
}, [supabase]);

async function load() {
if (!threadId) return;
try {
setErr("");
const { data, error } = await supabase
.from("messages")
.select("id,thread_id,sender_id,body,created_at")
.eq("thread_id", threadId)
.order("created_at", { ascending: true })
.limit(200);

if (error) throw error;
setItems((data ?? []) as Msg[]);
} catch (e: any) {
setErr(e?.message || "Failed to load messages.");
}
}

useEffect(() => {
load();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [threadId]);

async function send() {
if (!threadId) return;
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

const { error } = await supabase.from("messages").insert({
thread_id: threadId,
sender_id: user.id,
body: text.trim(),
});

if (error) throw error;

setText("");
await load();
} catch (e: any) {
setErr(e?.message || "Send failed.");
} finally {
setBusy(false);
}
}

return (
<div style={{ maxWidth: 780, margin: "0 auto", padding: "10px 0", position: "relative", zIndex: 60 }}>
<div style={{ color: "rgba(255,255,255,0.9)", fontWeight: 800, marginBottom: 10 }}>
THREAD VIEW ACTIVE
Conversation {threadId}
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
background: mine ? "rgba(168,85,247,0.18)" : "rgba(0,0,0,0.35)",
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

{err ? <div style={{ opacity: 0.85, color: "#ffd1ff" }}>{err}</div> : null}
</div>
</div>
);
}