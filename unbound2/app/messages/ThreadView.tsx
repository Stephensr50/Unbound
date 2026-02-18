"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type MsgRow = {
id: number;
conversation_id: number;
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

function isUuid(s: string) {
return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
s
);
}

export default function ThreadView() {
const supabase = useMemo(() => getSupabase(), []);
const params = useParams();
const router = useRouter();

// /messages/[id]
const rawId = typeof params?.id === "string" ? params.id : "";

const [mounted, setMounted] = useState(false);
const [me, setMe] = useState<string | null>(null);

const [conversationId, setConversationId] = useState<number | null>(null);
const [loading, setLoading] = useState(true);

const [msgs, setMsgs] = useState<MsgRow[]>([]);
const [text, setText] = useState("");
const [sending, setSending] = useState(false);
const [err, setErr] = useState<string | null>(null);

const bottomRef = useRef<HTMLDivElement | null>(null);

// prevents spamming mark-read calls
const markInFlightRef = useRef(false);
const lastMarkedIdRef = useRef<number | null>(null);

useEffect(() => setMounted(true), []);

// 1) Get session user
useEffect(() => {
(async () => {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMe(uid);
})();
}, [supabase]);

async function markConversationRead(convId: number, upToMessageId?: number | null) {
if (!me) return;
if (markInFlightRef.current) return;

try {
markInFlightRef.current = true;

let targetId: number | null = upToMessageId ?? null;

// If no explicit target, find latest message id in this conversation
if (targetId == null) {
const { data: latest, error: latestErr } = await supabase
.from("messages")
.select("id")
.eq("conversation_id", convId)
.order("id", { ascending: false })
.limit(1)
.maybeSingle();

if (latestErr) throw latestErr;
targetId = (latest?.id ?? null) as number | null;
}

// nothing to mark
if (targetId == null) return;

// avoid re-writing same id repeatedly
if (lastMarkedIdRef.current === targetId) return;

const { error: upsertErr } = await supabase
.from("conversation_reads")
.upsert(
{
conversation_id: convId,
user_id: me,
last_read_message_id: targetId,
updated_at: new Date().toISOString(),
},
{ onConflict: "conversation_id,user_id" }
);

if (upsertErr) throw upsertErr;

lastMarkedIdRef.current = targetId;

// ✅ NEW: tell TopNav/unread hook to refresh immediately
if (typeof window !== "undefined") {
window.dispatchEvent(new Event("unbound:refresh-unread"));
}
} catch (e: any) {
// Don't hard-fail the thread UI if this misses—just log it.
console.warn("markConversationRead failed:", e?.message ?? e);
} finally {
markInFlightRef.current = false;
}
}

// 2) Resolve rawId -> conversationId (supports int8 OR other user uuid)
useEffect(() => {
if (!mounted) return;
if (!me) return;
if (!rawId) return;

let cancelled = false;

(async () => {
setErr(null);
setLoading(true);

try {
// Case A: numeric conversation id
const asNum = Number.parseInt(rawId, 10);
if (Number.isFinite(asNum) && String(asNum) === rawId) {
if (!cancelled) setConversationId(asNum);
return;
}

// Case B: rawId is other user's uuid
if (!isUuid(rawId)) {
if (!cancelled) {
setErr("Bad conversation/user id in URL.");
setConversationId(null);
}
return;
}

const otherUserId = rawId;

// Find existing conversation between me + otherUserId
const { data: myMemberships, error: memErr } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", me);

if (memErr) throw memErr;

const convIds = (myMemberships ?? []).map((r) => r.conversation_id);
let foundConvId: number | null = null;

if (convIds.length > 0) {
const { data: otherMemberships, error: otherErr } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", otherUserId)
.in("conversation_id", convIds);

if (otherErr) throw otherErr;

foundConvId = otherMemberships?.[0]?.conversation_id ?? null;
}

// If not found, create it
if (!foundConvId) {
const { data: newConv, error: convErr } = await supabase
.from("conversations")
.insert({})
.select("id")
.single();

if (convErr) throw convErr;
foundConvId = newConv.id;

const { error: cmErr } = await supabase.from("conversation_members").insert([
{ conversation_id: foundConvId, user_id: me },
{ conversation_id: foundConvId, user_id: otherUserId },
]);

if (cmErr) throw cmErr;

// Optional: switch URL to numeric conv id so everything is consistent
router.replace(`/messages/${foundConvId}`);
}

if (!cancelled) setConversationId(foundConvId);
} catch (e: any) {
if (!cancelled) {
setErr(e?.message ?? "Failed to open conversation.");
setConversationId(null);
}
} finally {
if (!cancelled) setLoading(false);
}
})();

return () => {
cancelled = true;
};
}, [mounted, me, rawId, supabase, router]);

// 3) Load messages for conversationId
useEffect(() => {
if (!conversationId) return;

let cancelled = false;

(async () => {
try {
const { data, error } = await supabase
.from("messages")
.select("id, conversation_id, sender_id, body, created_at")
.eq("conversation_id", conversationId)
.order("id", { ascending: true });

if (error) throw error;

const rows = (data ?? []) as MsgRow[];
if (!cancelled) setMsgs(rows);

// ✅ Mark read up to latest loaded message
const latestId = rows.length ? rows[rows.length - 1].id : null;
if (latestId != null) {
await markConversationRead(conversationId, latestId);
}
} catch (e: any) {
if (!cancelled) setErr(e?.message ?? "Failed to load messages.");
} finally {
if (!cancelled) {
setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
}
}
})();

return () => {
cancelled = true;
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [conversationId, supabase]);

// 4) Realtime: new messages -> append
useEffect(() => {
if (!conversationId) return;

const ch = supabase
.channel(`thread-${conversationId}`)
.on(
"postgres_changes",
{
event: "INSERT",
schema: "public",
table: "messages",
filter: `conversation_id=eq.${conversationId}`,
},
async (payload) => {
const row = payload.new as any;

setMsgs((prev) => {
if (prev.some((m) => m.id === row.id)) return prev;
return [...prev, row as MsgRow];
});

setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

// ✅ If we're viewing the thread, treat new message as read immediately
if (me && row?.id != null) {
await markConversationRead(conversationId, Number(row.id));
}
}
)
.subscribe();

return () => {
supabase.removeChannel(ch);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [conversationId, supabase, me]);

async function send() {
if (!conversationId) return;
if (!me) return;
const body = text.trim();
if (!body) return;
if (sending) return;

setSending(true);
setErr(null);

try {
const { error } = await supabase.from("messages").insert({
conversation_id: conversationId,
sender_id: me,
body,
});

if (error) throw error;

setText("");
} catch (e: any) {
setErr(e?.message ?? "Send failed.");
} finally {
setSending(false);
}
}

// --- render ---
return (
<div style={{ padding: 18 }}>
<div style={{ opacity: 0.85, marginBottom: 10, fontFamily: '"Gloock", serif' }}>
{mounted && me ? `ME: ${me.slice(0, 4)}…${me.slice(-4)}` : "ME: …"}
</div>

<div style={{ fontFamily: '"Gloock", serif', fontSize: 22, marginBottom: 12 }}>
{loading ? "Conversation…" : conversationId ? `Conversation #${conversationId}` : "Conversation"}
</div>

{err ? <div style={{ color: "salmon", marginBottom: 10, fontWeight: 700 }}>{err}</div> : null}

<div
style={{
border: "1px solid rgba(168,85,247,0.22)",
background: "rgba(0,0,0,0.35)",
borderRadius: 18,
padding: 14,
minHeight: 340,
maxHeight: 460,
overflowY: "auto",
}}
>
{loading ? (
<div style={{ opacity: 0.8 }}>Loading…</div>
) : msgs.length === 0 ? (
<div style={{ opacity: 0.8 }}>No messages yet.</div>
) : (
msgs.map((m) => {
const mine = !!me && m.sender_id === me;

return (
<div
key={m.id}
style={{
width: "100%",
display: "flex",
justifyContent: mine ? "flex-end" : "flex-start",
marginBottom: 10,
}}
>
<div
style={{
// bubble
maxWidth: "72%",
width: "fit-content",
padding: "10px 12px",
borderRadius: 14,
border: "1px solid rgba(168,85,247,0.18)",
background: mine ? "rgba(169, 85, 247, 0.28)" : "rgba(215, 118, 228, 0.14)",
}}
>
<div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}></div>
<div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
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
placeholder={conversationId ? "Write a message…" : "Open a conversation…"}
disabled={!conversationId || sending}
style={{
flex: 1,
padding: "10px 12px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.25)",
background: "rgba(44, 35, 35, 0.15)",
color: "white",
outline: "none",
}}
onKeyDown={(e) => {
if (e.key === "Enter") send();
}}
/>
<button
onClick={send}
disabled={!conversationId || sending || !text.trim()}
style={{
padding: "10px 14px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(168,85,247,0.20)",
color: "white",
fontWeight: 900,
cursor: "pointer",
}}
>
Send
</button>
</div>
</div>
);
}