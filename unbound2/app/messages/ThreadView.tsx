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

// typing indicator
const [otherTyping, setOtherTyping] = useState(false);
const otherTypingTimerRef = useRef<number | null>(null);
const lastTypingSentAtRef = useRef(0);
const stopTypingTimerRef = useRef<number | null>(null);
const [otherLastReadId, setOtherLastReadId] = useState<number>(0);

const lastMineId = useMemo(() => {
if (!me) return 0;
let last = 0;
for (const m of msgs) {
if (m.sender_id === me) {
const idNum = Number((m as any).id);
if (!Number.isNaN(idNum)) last = Math.max(last, idNum);
}
}
return last;
}, [msgs, me]);

const showSeen = lastMineId > 0 && otherLastReadId >= lastMineId;

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

if (targetId == null) return;
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

// tell TopNav/unread hook to refresh immediately
if (typeof window !== "undefined") {
window.dispatchEvent(new Event("unbound:refresh-unread"));
}
} catch (e: any) {
console.warn("markConversationRead failed:", e?.message ?? e);
} finally {
markInFlightRef.current = false;
}
}

async function loadOtherReadPointer(convId: number) {
if (!me) return;

// get members of this conversation
const { data: members, error: memErr } = await supabase
.from("conversation_members")
.select("user_id")
.eq("conversation_id", convId);

if (memErr || !members) return;

// find the other user (not me)
const otherId =
members.map((m: any) => m.user_id as string).find((id) => id && id !== me) ??
null;

if (!otherId) return;

// read their read-pointer row
console.log("READ DEBUG", { convId, me, otherId });
const { data: readRow } = await supabase
.from("conversation_reads")
.select("last_read_message_id")
.eq("conversation_id", convId)
.eq("user_id", otherId)
.maybeSingle();

setOtherLastReadId(Number(readRow?.last_read_message_id ?? 0));
}

// typing helpers
function clearOtherTypingSoon(ms = 1200) {
if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current);
otherTypingTimerRef.current = window.setTimeout(() => setOtherTyping(false), ms);
}

async function sendTyping(ch: any, typing: boolean) {
if (!conversationId || !me) return;

// throttle "typing:true" so we don't spam
if (typing) {
const now = Date.now();
if (now - lastTypingSentAtRef.current < 400) return;
lastTypingSentAtRef.current = now;
}

try {
await ch.send({
type: "broadcast",
event: "typing",
payload: {
conversation_id: conversationId,
user_id: me,
typing,
at: Date.now(),
},
});
} catch {
// ignore
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

const latestId = rows.length ? rows[rows.length - 1].id : null;
if (latestId != null) {
await markConversationRead(conversationId, latestId);
await loadOtherReadPointer(conversationId);
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

// 4) Realtime: messages + typing indicator (broadcast)
useEffect(() => {
if (!conversationId) return;

setOtherTyping(false);

const ch = supabase
.channel(`thread-${conversationId}`)
// messages
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

// mark read while we're here
if (me && row?.id != null) {
await markConversationRead(conversationId, Number(row.id));
}
}
)

// typing broadcasts
.on("broadcast", { event: "typing" }, (payload: any) => {
const p = payload?.payload ?? payload;
const from = p?.user_id as string | undefined;
const typing = !!p?.typing;

if (!from || !me) return;
if (from === me) return; // ignore our own

if (typing) {
setOtherTyping(true);
clearOtherTypingSoon(1600);
} else {
setOtherTyping(false);
}
})
.subscribe();

// make sure if we leave the page we stop typing
const stopNow = () => {
if (stopTypingTimerRef.current) window.clearTimeout(stopTypingTimerRef.current);
sendTyping(ch, false);
};

window.addEventListener("beforeunload", stopNow);

return () => {
window.removeEventListener("beforeunload", stopNow);
// best-effort "stop typing" on unmount
sendTyping(ch, false);
supabase.removeChannel(ch);
if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current);
if (stopTypingTimerRef.current) window.clearTimeout(stopTypingTimerRef.current);
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
// stop typing immediately when we send
const ch = supabase.channel(`thread-${conversationId}`);
await sendTyping(ch, false);
setOtherTyping(false);

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

// typing: send broadcasts based on local input
useEffect(() => {
if (!conversationId || !me) return;

// we need the live channel that is subscribed; easiest is to reuse the same name
// supabase will reuse the existing channel instance internally for sends.
const ch = supabase.channel(`thread-${conversationId}`);

const hasText = text.trim().length > 0;

// if user is typing, send typing:true and schedule a stop after inactivity
if (hasText) {
sendTyping(ch, true);

if (stopTypingTimerRef.current) window.clearTimeout(stopTypingTimerRef.current);
stopTypingTimerRef.current = window.setTimeout(() => {
sendTyping(ch, false);
}, 1200);
} else {
// if input cleared, stop typing
if (stopTypingTimerRef.current) window.clearTimeout(stopTypingTimerRef.current);
sendTyping(ch, false);
}

return () => {};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [text, conversationId, me]);

// --- render ---
return (
<div style={{ padding: 18, paddingTop: 15 }}>
    <div style={{ height: 96}} />
<div style={{ opacity: 0.85, marginBottom: 10, fontFamily: '"Gloock", serif' }}>
{mounted && me ? `ME: ${me.slice(0, 4)}…${me.slice(-4)}` : "ME: …"}
</div>

<button
onClick={() => router.push("/messages")}
style={{
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(169, 85, 247, 0.42)",
boxShadow: "0 0 14px rgba(168,85,247,0.44",
color: "white",
cursor: "pointer",
fontWeight: 650,
marginBottom: 14,
}}
>
← Back
</button>

<div style={{ fontFamily: '"Gloock", serif', fontSize: 22, marginBottom: 8 }}>
{loading ? "Conversation…" : conversationId ? `Conversation #${conversationId}` : "Conversation"}
</div>

{err ? (
<div style={{ color: "salmon", marginBottom: 10, fontWeight: 700 }}>{err}</div>
) : null}

<div
style={{
border: "1px solid rgba(168,85,247,0.22)",
background: "rgba(0,0,0,0.35)",
borderRadius: 18,
padding: "14px 14px 70px 14px",
minHeight: 340,
maxHeight: 460,
overflowY: "auto",
scrollPaddingBottom: 70,
}}
>
{loading ? (
<div style={{ opacity: 0.8 }}>Loading…</div>
) : msgs.length === 0 ? (
<div style={{ opacity: 0.8 }}>No messages yet.</div>
) : (
msgs.map((m, idx) => {
const mine = !!me && m.sender_id === me;
const mid = Number(m.id);

// find your last message id
const lastMineId = (() => {
for (let i = msgs.length - 1; i >= 0; i--) {
if (msgs[i].sender_id === me) {
return Number(msgs[i].id);
}
}
return null;
})();

const seen =
mine &&
lastMineId !== null &&
mid === lastMineId &&
otherLastReadId >= lastMineId;

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
{mine && idx === msgs.length - 1 && showSeen ? (
<div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
Seen
</div>
) : null}
</div>
</div>
);
})
)}

{/* typing indicator bubble */}
{otherTyping ? (
<div
style={{
width: "100%",
display: "flex",
justifyContent: "flex-start",
marginTop: 10,
marginBottom: 14,
}}
>
<div
style={{
maxWidth: "60%",
padding: "8px 12px",
borderRadius: 14,
border: "1px solid rgba(168,85,247,0.18)",
background: "rgba(215, 118, 228, 0.10)",
fontSize: 13,
fontWeight: 800,
opacity: 0.95,
display: "inline-flex",
alignItems: "center",
}}
>
Typing
<span className="unbound-typing-dots">
<span />
<span />
<span />
</span>
</div>
</div>
) : null}

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
onBlur={() => {
// stop typing when input loses focus
if (conversationId) {
const ch = supabase.channel(`thread-${conversationId}`);
sendTyping(ch, false);
}
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

<div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}></div>
</div>
);
}