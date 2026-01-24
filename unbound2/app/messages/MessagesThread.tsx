"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = {
id: string;
from: "them" | "me";
text: string;
ts?: string;
};

const THREADS_KEY = "unbound_unread_threads";
const UNREAD_EVENT = "unbound:unread";

function loadUnreadThreads(): Record<string, number> {
try {
const raw = localStorage.getItem(THREADS_KEY);
const parsed = raw ? JSON.parse(raw) : {};
return parsed && typeof parsed === "object" ? parsed : {};
} catch {
return {};
}
}

function saveUnreadThreads(next: Record<string, number>) {
try {
localStorage.setItem(THREADS_KEY, JSON.stringify(next));
window.dispatchEvent(new Event(UNREAD_EVENT));
} catch {
// ignore
}
}

function markThreadRead(threadId: string) {
const unread = loadUnreadThreads();
if ((unread[threadId] ?? 0) > 0) {
unread[threadId] = 0;
saveUnreadThreads(unread);
}
}

export default function MessagesThread({ threadId }: { threadId: string }) {
const storageKey = `unbound_thread_${threadId}`;

const seeded: Msg[] = useMemo(
() => [
{ id: "1", from: "them", text: "Hey there" },
{ id: "2", from: "me", text: "Hey! What’s up?" },
{ id: "3", from: "them", text: "Just testing messaging 👀" },
],
[]
);

const [messages, setMessages] = useState<Msg[]>(seeded);
const [draft, setDraft] = useState("");
const bottomRef = useRef<HTMLDivElement | null>(null);
const inputRef = useRef<HTMLInputElement | null>(null);

// Load saved thread messages when threadId changes
useEffect(() => {
try {
const raw = localStorage.getItem(storageKey);
if (raw) {
const parsed = JSON.parse(raw) as Msg[];
if (Array.isArray(parsed)) {
setMessages(parsed);
return;
}
}
setMessages(seeded);
} catch {
setMessages(seeded);
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [threadId]);

// Mark this thread read as soon as you open it
useEffect(() => {
markThreadRead(threadId);
}, [threadId]);

// Persist messages whenever they change
useEffect(() => {
try {
localStorage.setItem(storageKey, JSON.stringify(messages));
} catch {
// ignore
}
}, [messages, storageKey]);

// Scroll to bottom on new messages
useEffect(() => {
bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages.length]);

function send() {
const text = draft.trim();
if (!text) return;

setMessages((prev) => [...prev, { id: String(Date.now()), from: "me", text }]);
setDraft("");
requestAnimationFrame(() => inputRef.current?.focus());
}

return (
<div
style={{
maxWidth: 760,
margin: "0 auto",
padding: "16px 14px 90px",
}}
>
<h2 style={{ fontSize: 42, fontWeight: 700, marginBottom: 14 }}>
Conversation {threadId}
</h2>

{/* Messages */}
<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{messages.map((m) => {
const isMe = m.from === "me";
return (
<div
key={m.id}
style={{
display: "flex",
justifyContent: isMe ? "flex-end" : "flex-start",
}}
>
<div
style={{
maxWidth: "78%",
padding: "10px 12px",
borderRadius: 16,
lineHeight: 1.25,
fontSize: 18,
background: isMe
? "rgba(186, 104, 255, 0.22)"
: "rgba(255,255,255,0.12)",
border: "1px solid rgba(255,255,255,0.12)",
backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
}}
>
{m.text}
</div>
</div>
);
})}
<div ref={bottomRef} />
</div>

{/* Composer */}
<div
style={{
position: "fixed",
left: 0,
right: 0,
bottom: 0,
padding: "12px 14px",
background: "rgba(0,0,0,0.45)",
borderTop: "1px solid rgba(255,255,255,0.10)",
backdropFilter: "blur(12px)",
WebkitBackdropFilter: "blur(12px)",
}}
>
<div
style={{
maxWidth: 760,
margin: "0 auto",
display: "flex",
gap: 10,
alignItems: "center",
}}
>
<input
ref={inputRef}
value={draft}
onChange={(e) => setDraft(e.target.value)}
onKeyDown={(e) => {
if (e.key === "Enter") send();
}}
placeholder="Message…"
style={{
flex: 1,
height: 46,
borderRadius: 999,
padding: "0 14px",
fontSize: 16,
color: "white",
background: "rgba(255,255,255,0.10)",
border: "1px solid rgba(255,255,255,0.14)",
outline: "none",
}}
/>
<button
onClick={send}
style={{
height: 46,
padding: "0 16px",
borderRadius: 999,
fontSize: 16,
fontWeight: 700,
color: "white",
background: "rgba(186, 104, 255, 0.35)",
border: "1px solid rgba(186, 104, 255, 0.55)",
cursor: "pointer",
}}
>
Send
</button>
</div>
</div>
</div>
);
}