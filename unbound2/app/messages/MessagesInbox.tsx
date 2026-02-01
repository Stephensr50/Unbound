"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type InboxRow = {
id: number;
last_message_at: string | null;
messages: {
body: string;
created_at: string;
sender_id: string | null;
}[];
};

// ✅ singleton client (prevents weird re-init + effect churn)
const supabase = (() => {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
return createClient(url, key);
})();

export default function MessagesInbox() {
const [threads, setThreads] = useState<InboxRow[]>([]);
const [loading, setLoading] = useState(true); // first load only
const [err, setErr] = useState("");

const inFlightRef = useRef(false);
const lastSigRef = useRef("");

async function loadInbox(opts?: { silent?: boolean }) {
const silent = opts?.silent ?? false;
if (inFlightRef.current) return;

inFlightRef.current = true;
if (!silent) setLoading(true);

const { data, error } = await supabase
.from("conversations")
.select(`
id,
last_message_at,
messages!messages_conversation_id_fkey (
body,
created_at,
sender_id
)
`)
.order("created_at", {
foreignTable: "messages!messages_conversation_id_fkey",
ascending: false,
})
.limit(1, { foreignTable: "messages!messages_conversation_id_fkey" })
.order("last_message_at", { ascending: false, nullsFirst: false });

inFlightRef.current = false;
if (!silent) setLoading(false);

if (error) {
console.error("Inbox load error:", error);
setErr(error.message || "Inbox load failed.");
if (!silent) setThreads([]);
return;
}

setErr("");
const rows = (data ?? []) as InboxRow[];

// ✅ Only re-render if data actually changed
const sig = rows
.map(
(r) =>
`${r.id}:${r.last_message_at ?? ""}:${r.messages?.[0]?.created_at ?? ""}:${r.messages?.[0]?.body ?? ""}`
)
.join("|");

if (sig !== lastSigRef.current) {
lastSigRef.current = sig;
setThreads(rows);
}
}

useEffect(() => {
// first load
loadInbox({ silent: false });

// ✅ refresh ONLY when user comes back to the tab
const onFocus = () => loadInbox({ silent: true });
const onVis = () => {
if (document.visibilityState === "visible") loadInbox({ silent: true });
};

window.addEventListener("focus", onFocus);
document.addEventListener("visibilitychange", onVis);

return () => {
window.removeEventListener("focus", onFocus);
document.removeEventListener("visibilitychange", onVis);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

if (loading) {
return <div className="p-4 text-gray-400">Loading messages…</div>;
}

if (err) {
return (
<div className="p-4 text-gray-300">
<div style={{ color: "#ffd1ff", opacity: 0.95, fontWeight: 800 }}>
Inbox error
</div>
<div style={{ opacity: 0.85, marginTop: 6 }}>{err}</div>

<button
onClick={() => loadInbox({ silent: false })}
style={{
marginTop: 12,
padding: "10px 14px",
borderRadius: 12,
border: "1px solid rgba(185, 110, 255, 0.65)",
background: "rgba(155, 60, 255, 0.20)",
color: "white",
cursor: "pointer",
fontWeight: 700,
}}
>
Refresh
</button>
</div>
);
}

if (!threads.length) {
return (
<div className="p-4 text-gray-400">
No conversations yet
<div style={{ marginTop: 10 }}>
<button
onClick={() => loadInbox({ silent: false })}
style={{
padding: "10px 14px",
borderRadius: 12,
border: "1px solid rgba(185, 110, 255, 0.65)",
background: "rgba(155, 60, 255, 0.20)",
color: "white",
cursor: "pointer",
fontWeight: 700,
}}
>
Refresh
</button>
</div>
</div>
);
}

return (
<div className="flex flex-col gap-3 p-4">
<div style={{ display: "flex", justifyContent: "flex-end" }}>
<button
onClick={() => loadInbox({ silent: true })}
style={{
padding: "8px 12px",
borderRadius: 12,
border: "1px solid rgba(185, 110, 255, 0.55)",
background: "rgba(155, 60, 255, 0.14)",
color: "white",
cursor: "pointer",
fontWeight: 700,
opacity: 0.9,
}}
>
Refresh
</button>
</div>

{threads.map((t) => {
const last = t.messages?.[0];
const isHot =
last &&
Date.now() - new Date(last.created_at).getTime() < 5 * 60 * 1000;

return (
<Link
key={t.id}
href={`/messages/${t.id}`}
className="rounded-lg border border-white/10 p-3 hover:bg-white/5 transition"
>
<div
className="text-sm text-white"
style={{ display: "flex", alignItems: "center", gap: 10 }}
>
<span>{last?.body ?? "New conversation"}</span>

{isHot ? (
<span
style={{
width: 8,
height: 8,
borderRadius: 999,
background: "rgba(185,110,255,0.95)",
boxShadow: "0 0 12px rgba(185,110,255,0.8)",
display: "inline-block",
}}
/>
) : null}
</div>

<div className="text-xs text-gray-400 mt-1">
{last ? new Date(last.created_at).toLocaleString() : ""}
</div>
</Link>
);
})}
</div>
);
}