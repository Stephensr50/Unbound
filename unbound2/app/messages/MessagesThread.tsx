"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type MessageRow = {
id: number;
conversation_id: string;
sender_id: string;
body: string;
created_at: string;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars.");
return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
}

export default function MessagesThread({ threadId }: { threadId: string }) {
const supabase = useMemo(() => getSupabase(), []);
const [me, setMe] = useState<string | null>(null);

const [messages, setMessages] = useState<MessageRow[]>([]);
const [loading, setLoading] = useState(true);
const [text, setText] = useState("");

const bottomRef = useRef<HTMLDivElement | null>(null);

const scrollToBottom = (smooth = true) => {
bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
};

useEffect(() => {
let alive = true;

async function load() {
setLoading(true);

// who am I
const { data: authData } = await supabase.auth.getUser();
const uid = authData?.user?.id ?? null;
if (!alive) return;
setMe(uid);

// load messages for this conversation/thread
const { data, error } = await supabase
.from("messages")
.select("id, conversation_id, sender_id, body, created_at")
.eq("conversation_id", threadId)
.order("created_at", { ascending: true });

if (error) console.error("load messages error:", error);

if (!alive) return;
setMessages(((data as MessageRow[]) ?? []).filter(Boolean));
setLoading(false);

setTimeout(() => scrollToBottom(false), 50);
}

load();

return () => {
alive = false;
};
}, [supabase, threadId]);

async function send() {
const trimmed = text.trim();
if (!trimmed) return;

const { data: authData } = await supabase.auth.getUser();
const uid = authData?.user?.id;

if (!uid) {
alert("You must be logged in to send messages.");
return;
}

setText("");

const optimistic: MessageRow = {
id: -Date.now(),
conversation_id: threadId,
sender_id: uid,
body: trimmed,
created_at: new Date().toISOString(),
};

setMessages((prev) => [...prev, optimistic]);
setTimeout(() => scrollToBottom(true), 10);

const { data, error } = await supabase
.from("messages")
.insert([{ conversation_id: threadId, sender_id: uid, body: trimmed }])
.select("id, conversation_id, sender_id, body, created_at")
.single();

if (error) {
console.error("send error:", error);
setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
alert("Send failed. (Likely RLS) — see SQL below.");
return;
}

setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? (data as MessageRow) : m)));
setTimeout(() => scrollToBottom(true), 10);
}

function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
send();
}
}

return (
<div className="min-h-screen unbound-bg px-4 pt-4 pb-24">
<div className="max-w-2xl mx-auto">
<div className="mb-3 flex items-center gap-2">
<a href="/messages" className="text-sm opacity-80 hover:opacity-100">
← Back
</a>
<div className="text-sm opacity-70">Thread: {threadId.slice(0, 8)}…</div>
</div>

<div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
{loading ? (
<div className="opacity-80">Loading…</div>
) : messages.length === 0 ? (
<div className="opacity-80">No messages yet. Send the first one 👇</div>
) : (
<div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
{messages.map((m) => {
const mine = me && m.sender_id === me;
return (
<div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
<div
className={[
"max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
mine
? "bg-white/15 border border-white/20"
: "bg-black/50 border border-white/10",
].join(" ")}
>
<div className="whitespace-pre-wrap">{m.body}</div>
<div className="mt-1 text-[11px] opacity-60">
{new Date(m.created_at).toLocaleString()}
</div>
</div>
</div>
);
})}
<div ref={bottomRef} />
</div>
)}
</div>

{/* composer */}
<div className="fixed left-0 right-0 bottom-0 px-4 pb-4">
<div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-3">
<div className="flex gap-2 items-end">
<textarea
value={text}
onChange={(e) => setText(e.target.value)}
onKeyDown={onKeyDown}
placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
className="flex-1 min-h-[44px] max-h-40 resize-y rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none"
/>
<button
onClick={send}
className="rounded-xl px-4 py-2 text-sm border border-white/15 bg-white/10 hover:bg-white/15"
>
Send
</button>
</div>
</div>
</div>
</div>
</div>
);
}