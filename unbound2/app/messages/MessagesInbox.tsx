"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Thread = {
id: string;
label: string;
};

const THREADS: Thread[] = [{ id: "1", label: "Conversation 1" }];

const STORAGE_KEY = "unbound_unread_threads";
const UNREAD_EVENT = "unbound:unread";

function loadUnread(): Record<string, number> {
try {
const raw = localStorage.getItem(STORAGE_KEY);
const parsed = raw ? JSON.parse(raw) : {};
return parsed && typeof parsed === "object" ? parsed : {};
} catch {
return {};
}
}

function seedUnreadIfMissing() {
try {
const existing = loadUnread();
const hasAny = Object.keys(existing).length > 0;

if (!hasAny) {
// Seed ONLY the threads that actually exist in the UI
const seeded: Record<string, number> = {};
for (const t of THREADS) seeded[t.id] = 0;

// Optional: give Conversation 1 a fake unread count
seeded["1"] = 2;

localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
}
} catch {
// ignore
}
}

export default function MessagesInbox() {
const [unread, setUnread] = useState<Record<string, number>>({});

useEffect(() => {
const refresh = () => setUnread(loadUnread());

// 1) seed once (if missing), then load
seedUnreadIfMissing();
refresh();

// 2) update when thread page marks read (same tab)
window.addEventListener(UNREAD_EVENT, refresh);

// 3) update if localStorage changes in another tab
const onStorage = (e: StorageEvent) => {
if (e.key === STORAGE_KEY) refresh();
};
window.addEventListener("storage", onStorage);

// 4) update when you come back to this tab
const onFocus = () => refresh();
window.addEventListener("focus", onFocus);

return () => {
window.removeEventListener(UNREAD_EVENT, refresh);
window.removeEventListener("storage", onStorage);
window.removeEventListener("focus", onFocus);
};
}, []);

return (
<div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
<h2 style={{ fontSize: 42, marginBottom: 14 }}>Inbox</h2>

<ul style={{ listStyle: "none", padding: 0 }}>
{THREADS.map((t) => {
const count = unread[t.id] ?? 0;

return (
<li key={t.id} style={{ marginBottom: 10 }}>
<Link
href={`/messages/${t.id}`}
style={{
fontSize: 18,
color: "rgba(168,85,247,1)",
textDecoration: "none",
display: "inline-flex",
alignItems: "center",
gap: 8,
}}
>
{t.label}

{count > 0 && (
<span
style={{
minWidth: 20,
height: 20,
padding: "0 6px",
borderRadius: 999,
fontSize: 12,
fontWeight: 700,
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
background: "rgba(168,85,247,0.9)",
color: "black",
boxShadow: "0 0 10px rgba(168,85,247,0.8)",
}}
>
{count}
</span>
)}
</Link>
</li>
);
})}
</ul>
</div>
);
}