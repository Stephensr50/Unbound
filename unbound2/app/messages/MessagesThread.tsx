"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useParams, useRouter } from "next/navigation";

type MessageRow = {
id: string;
thread_id: string;
sender_id: string | null;
body: string;
created_at?: string;
};

function getSupabase(): SupabaseClient {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

return createClient(url, key, {
auth: { persistSession: true, autoRefreshToken: true },
});
}

function safeId() {
return typeof crypto !== "undefined" && "randomUUID" in crypto
? crypto.randomUUID()
: `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const LS_PREFIX = "unbound_messages_thread_";

export default function MessagesThread(props: { threadId?: string }) {
const router = useRouter();
const params = useParams();

// Works whether you pass threadId as prop or rely on /messages/[id]


const threadId =
props.threadId ??
(typeof (params as any)?.threadId === "string"
? (params as any).threadId
: Array.isArray((params as any)?.threadId)
? (params as any).threadId[0]
: "1");

const supabase = useMemo(() => {
try {
return getSupabase();
} catch {
return null;
}
}, []);

const [me, setMe] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
const [messages, setMessages] = useState<MessageRow[]>([]);
const [text, setText] = useState("");

const bottomRef = useRef<HTMLDivElement | null>(null);

// Title like your screenshot
const safeThreadId = threadId ?? "1";
const convLabel = `Conversation ${safeThreadId}`;

// ---------- localStorage fallback (always works) ----------
function lsKey(id: string) {
return `${LS_PREFIX}${id}`;
}

function loadFromLocalStorage() {
try {
const raw = localStorage.getItem(lsKey(threadId));
if (!raw) return [];
const parsed = JSON.parse(raw);
return Array.isArray(parsed) ? (parsed as MessageRow[]) : [];
} catch {
return [];
}
}

function saveToLocalStorage(next: MessageRow[]) {
try {
localStorage.setItem(lsKey(threadId), JSON.stringify(next));
} catch {
// ignore
}
}

// ---------- data ----------
async function fetchMe() {
if (!supabase) return null;
try {
const { data } = await supabase.auth.getUser();
return data?.user?.id ?? null;
} catch {
return null;
}
}

async function fetchMessages() {
// Try Supabase first. If your table/schema isn't ready, we fallback to localStorage.
if (supabase) {
try {
const { data, error } = await supabase
.from("messages")
.select("id, thread_id, sender_id, body, created_at")
.eq("thread_id", threadId)
.order("created_at", { ascending: true });

if (!error && Array.isArray(data)) {
return data as MessageRow[];
}
} catch {
// fall through
}
}

return loadFromLocalStorage();
}

async function send() {
const body = text.trim();
if (!body) return;

const newRow: MessageRow = {
id: safeId(),
thread_id: threadId,
sender_id: me,
body,
created_at: new Date().toISOString(),
};

setText("");

// optimistic UI
setMessages((prev) => {
const next = [...prev, newRow];
saveToLocalStorage(next);
return next;
});

// Try Supabase insert, but never break UI if it fails
if (supabase) {
try {
await supabase.from("messages").insert({
id: newRow.id,
thread_id: newRow.thread_id,
sender_id: newRow.sender_id,
body: newRow.body,
});
} catch {
// ignore (localStorage already has it)
}
}
}

function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
void send();
}
}

useEffect(() => {
let cancelled = false;

(async () => {
setLoading(true);

const uid = await fetchMe();
if (!cancelled) setMe(uid);

const rows = await fetchMessages();
if (!cancelled) {
setMessages(rows);
setLoading(false);
setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 0);
}
})();

return () => {
cancelled = true;
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [threadId]);

useEffect(() => {
bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages.length]);

// ---------- styles (no “stacked cards”, no timestamps, no visible scrollbar) ----------
const page: React.CSSProperties = {
position: "relative",
paddingTop: 5,
paddingLeft: 24,
paddingRight: 24,
paddingBottom: 96,
minHeight: "100vh",
};

const titleWrap: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 12,
marginTop: 24,
marginBottom: 14,
};

const backBtn: React.CSSProperties = {
width: 42,
height: 42,
borderRadius: 999,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.28)",
color: "rgba(255,255,255,0.95)",
cursor: "pointer",
};

const title: React.CSSProperties = {
fontSize: 40,
lineHeight: 1.05,
letterSpacing: 0.2,
color: "rgb(168, 85, 247)",
textShadow: "0 0 12px rgba(168, 85, 247, 0.7), 0 0 28px rgba(168, 85, 247, 0.55)",
fontWeight: 600,
};

const messagesWrap: React.CSSProperties = {
display: "flex",
flexDirection: "column",
gap: 14,
paddingTop: 10,
paddingBottom: 16,
maxWidth: 1100,
};

const rowBase: React.CSSProperties = {
display: "flex",
width: "100%",
};

const rowMine: React.CSSProperties = {
...rowBase,
justifyContent: "flex-end",
paddingRight: 80,
};

const rowTheirs: React.CSSProperties = {
...rowBase,
justifyContent: "flex-start",
};

const bubbleBase: React.CSSProperties = {
maxWidth: "60vw",
width: "fit-content",
padding: "10px 14px",
borderRadius: 18,
lineHeight: 1.25,
fontSize: 18,
backdropFilter: "blur(10px)",
boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
wordBreak: "break-word",
};

const bubbleMine: React.CSSProperties = {
...bubbleBase,
background: "rgba(168,85,247,0.33)",
border: "1px solid rgba(210,170,255,0.45)",
color: "rgba(255,255,255,0.95)",
textShadow: "0 4px 18px rgba(0,0,0,0.45)",
};

const bubbleTheirs: React.CSSProperties = {
...bubbleBase,
background: "rgba(255,255,255,0.10)",
border: "1px solid rgba(255,255,255,0.16)",
color: "rgba(255,255,255,0.92)",
textShadow: "0 4px 18px rgba(0,0,0,0.45)",
};

// Long skinny bar centered, send button at the end
const composerShell: React.CSSProperties = {
position: "fixed",
left: "50%",
transform: "translateX(-50%)",
bottom: 18,
width: "min(980px, calc(100vw - 48px))",
zIndex: 50,
};

const composerBar: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 12,
padding: "10px 12px",
borderRadius: 28,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.34)",
backdropFilter: "blur(12px)",
boxShadow: "0 14px 34px rgba(0,0,0,0.45)",
};

const textareaStyle: React.CSSProperties = {
flex: 1,
height: 44,
minHeight: 44,
maxHeight: 44,
resize: "none",
border: "none",
outline: "none",
background: "transparent",
color: "rgba(255,255,255,0.95)",
fontSize: 16,
lineHeight: "44px",
padding: "0 10px",
};

const sendBtn: React.CSSProperties = {
height: 44,
borderRadius: 22,
padding: "0 22px",
border: "1px solid rgba(210,170,255,0.55)",
background: "rgba(168,85,247,0.42)",
color: "rgba(255,255,255,0.95)",
cursor: "pointer",
fontSize: 16,
fontWeight: 600,
};

return (
<div style={page}>
    <div style={{ marginBottom: 16 }}>
<h1
style={{
color: "#a855f7",
fontSize: 40,
fontWeight: 600,
textShadow: "0 0 18px rgba(168,85,247,0.6)",
margin: 0,
}}
>

</h1>
</div>
{/* Hide scrollbars (no visible slider) but still allow scrolling */}
<style jsx global>{`
.unbound-chat-scroll {
overflow-y: auto;
scrollbar-width: none;
-ms-overflow-style: none;
}
.unbound-chat-scroll::-webkit-scrollbar {
width: 0px;
height: 0px;
}
`}</style>

<div style={{ maxWidth: 1100, margin: "0 auto" }}>
<div style={titleWrap}>
<button
type="button"
style={backBtn}
onClick={() => router.push("/messages")}
aria-label="Back"
title="Back"
>
←
</button>
<h1 style={title}>{convLabel}</h1>
</div>

<div className="unbound-chat-scroll" style={messagesWrap}>
{loading ? (
<div style={{ opacity: 0.85, paddingLeft: 6 }}>Loading…</div>
) : messages.length === 0 ? (
<div style={{ opacity: 0.85, paddingLeft: 6 }}>No messages yet. Send the first one.</div>
) : (
messages.map((m) => {
const mine = !!me && m.sender_id === me;
return (
<div key={m.id} style={mine ? rowMine : rowTheirs}>
<div style={mine ? bubbleMine : bubbleTheirs}>{m.body}</div>
</div>
);
})
)}
<div ref={bottomRef} />
</div>
</div>

<div style={composerShell}>
<div style={composerBar}>
<textarea
value={text}
onChange={(e) => setText(e.target.value)}
onKeyDown={onKeyDown}
placeholder="message…"
style={textareaStyle}
/>
<button type="button" onClick={send} style={sendBtn}>
Send
</button>
</div>
</div>
</div>
);
}