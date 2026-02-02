"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type InboxRow = {
id: number;
last_message_at: string | null;
messages: {
id: number;
body: string | null;
created_at: string;
sender_id: string | null;
}[];
};

type ReadRow = {
conversation_id: number;
last_read_message_id: number | null;
};

const supabase = (() => {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
return createClient(url, key);
})();

export default function MessagesInbox() {
const [threads, setThreads] = useState<InboxRow[]>([]);
const [loading, setLoading] = useState(true);
const [err, setErr] = useState("");

const [myUserId, setMyUserId] = useState<string | null>(null);
const [readsByConv, setReadsByConv] = useState<Record<number, number>>({});
const [unreadTotal, setUnreadTotal] = useState(0);

const inFlightRef = useRef(false);
const lastSigRef = useRef("");

async function refreshAuth() {
const { data, error } = await supabase.auth.getSession();
if (error) {
setMyUserId(null);
return null;
}
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadReads(conversationIds: number[], uid: string) {
if (!conversationIds.length) {
setReadsByConv({});
return {};
}

const { data, error } = await supabase
.from("conversation_reads")
.select("conversation_id,last_read_message_id")
.eq("user_id", uid)
.in("conversation_id", conversationIds);

if (error) {
console.error("Reads load error:", error);
setErr(error.message || "Could not load read status.");
setReadsByConv({});
return {};
}

const map: Record<number, number> = {};
((data ?? []) as ReadRow[]).forEach((r) => {
map[r.conversation_id] = r.last_read_message_id ?? 0;
});

setReadsByConv(map);
return map;
}

function computeUnreadTotal(
rows: InboxRow[],
readMap: Record<number, number>,
uid: string | null
) {
if (!uid) return 0;

// NOTE: This counts *threads* with unread, not total unread messages.
// That's fine for your inbox "Unread: X" label on this page.
return rows.reduce((acc, r) => {
const lastMsgId = r.messages?.[0]?.id ?? 0;
const lastRead = readMap[r.id] ?? 0;
return acc + (lastMsgId > lastRead ? 1 : 0);
}, 0);
}

async function loadInbox(opts?: { silent?: boolean }) {
const silent = opts?.silent ?? false;
if (inFlightRef.current) return;

inFlightRef.current = true;
if (!silent) setLoading(true);
setErr("");

const uid = myUserId ?? (await refreshAuth());

const { data, error } = await supabase
.from("conversations")
.select(
`
id,
last_message_at,
messages!messages_conversation_id_fkey (
id,
body,
created_at,
sender_id
)
`
)
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
setUnreadTotal(0);
return;
}

const rows = (data ?? []) as InboxRow[];

const sig = rows
.map((r) => {
const last = r.messages?.[0];
return `${r.id}:${r.last_message_at ?? ""}:${last?.id ?? ""}:${last?.created_at ?? ""}:${last?.body ?? ""}:${last?.sender_id ?? ""}`;
})
.join("|");

if (sig !== lastSigRef.current) {
lastSigRef.current = sig;
setThreads(rows);
}

if (!uid) {
setReadsByConv({});
setUnreadTotal(0);
return;
}

const convoIds = rows.map((r) => r.id);
const readMap = await loadReads(convoIds, uid);

const total = computeUnreadTotal(rows, readMap, uid);
setUnreadTotal(total);
}

useEffect(() => {
(async () => {
await refreshAuth();
await loadInbox({ silent: false });
})();

const onFocus = () => loadInbox({ silent: true });
const onVis = () => {
if (document.visibilityState === "visible") loadInbox({ silent: true });
};

window.addEventListener("focus", onFocus);
document.addEventListener("visibilitychange", onVis);

const t = window.setInterval(() => {
if (document.visibilityState === "visible") loadInbox({ silent: true });
}, 2500);

return () => {
window.clearInterval(t);
window.removeEventListener("focus", onFocus);
document.removeEventListener("visibilitychange", onVis);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// Recompute unread total whenever reads map changes (covers async state update)
useEffect(() => {
if (!myUserId) {
setUnreadTotal(0);
return;
}
const total = computeUnreadTotal(threads, readsByConv, myUserId);
setUnreadTotal(total);
}, [readsByConv, threads, myUserId]);

// ---- UI ----
const S = {
topRow: {
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
padding: "10px 12px",
borderRadius: 14,
border: "1px solid rgba(185,110,255,0.28)",
background: "rgba(155,60,255,0.08)",
marginBottom: 12,
} as const,
pill: {
padding: "6px 10px",
borderRadius: 999,
border: "1px solid rgba(185,110,255,0.45)",
background: "rgba(185,110,255,0.12)",
color: "rgba(255,255,255,0.92)",
fontWeight: 800,
fontSize: 12,
boxShadow: "0 0 18px rgba(185,110,255,0.10)",
} as const,
btn: {
padding: "8px 12px",
borderRadius: 12,
border: "1px solid rgba(185, 110, 255, 0.55)",
background: "rgba(155, 60, 255, 0.14)",
color: "white",
cursor: "pointer",
fontWeight: 700,
opacity: 0.92,
} as const,
card: (unread: boolean) =>
({
borderRadius: 14,
border: unread
? "1px solid rgba(185,110,255,0.55)"
: "1px solid rgba(255,255,255,0.10)",
background: unread ? "rgba(185,110,255,0.08)" : "rgba(0,0,0,0.18)",
padding: 12,
textDecoration: "none",
color: "white",
display: "block",
boxShadow: unread ? "0 0 22px rgba(185,110,255,0.12)" : "none",
} as const),
rowTop: {
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 10,
} as const,
preview: (unread: boolean) =>
({
fontSize: 14,
fontWeight: unread ? 900 : 650,
opacity: 0.95,
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
} as const),
meta: {
fontSize: 12,
opacity: 0.65,
marginTop: 6,
} as const,
unreadDot: {
width: 10,
height: 10,
borderRadius: 999,
background: "rgba(185,110,255,0.98)",
boxShadow: "0 0 16px rgba(185,110,255,0.85)",
flex: "0 0 auto",
} as const,
};

if (loading) {
return (
<div style={{ padding: 16, color: "rgba(255,255,255,0.65)" }}>
Loading messages…
</div>
);
}

if (err) {
return (
<div style={{ padding: 16, color: "rgba(255,255,255,0.85)" }}>
<div style={{ color: "#ffd1ff", opacity: 0.95, fontWeight: 900 }}>
Inbox error
</div>
<div style={{ opacity: 0.85, marginTop: 6 }}>{err}</div>

<button
onClick={() => loadInbox({ silent: false })}
style={{ ...S.btn, marginTop: 12 }}
>
Refresh
</button>
</div>
);
}

if (!threads.length) {
return (
<div style={{ padding: 16, color: "rgba(255,255,255,0.65)" }}>
No conversations yet
<div style={{ marginTop: 10 }}>
<button onClick={() => loadInbox({ silent: false })} style={S.btn}>
Refresh
</button>
</div>
</div>
);
}

return (
<div style={{ padding: 14 }}>
<div style={S.topRow}>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
<div style={S.pill}>Unread: {unreadTotal}</div>
{!myUserId ? (
<div style={{ fontSize: 12, opacity: 0.75 }}>
Not signed in (no unread)
</div>
) : null}
</div>

<button onClick={() => loadInbox({ silent: true })} style={S.btn}>
Refresh
</button>
</div>

<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{threads.map((t) => {
const last = t.messages?.[0];
const lastMsgId = last?.id ?? 0;
const lastRead = readsByConv[t.id] ?? 0;
const unread = !!myUserId && lastMsgId > lastRead;

return (
<Link key={t.id} href={`/messages/${t.id}`} style={S.card(unread)}>
<div style={S.rowTop}>
<div
style={{
display: "flex",
alignItems: "center",
gap: 10,
minWidth: 0,
}}
>
{unread ? <span style={S.unreadDot} /> : null}
<div style={{ minWidth: 0 }}>
<div style={S.preview(unread)}>
{last?.body ?? "New conversation"}
</div>
<div style={S.meta}>
{last ? new Date(last.created_at).toLocaleString() : ""}
</div>
</div>
</div>

{unread ? (
<div style={S.pill}>NEW</div>
) : (
<div style={{ fontSize: 12, opacity: 0.55 }}> </div>
)}
</div>
</Link>
);
})}
</div>
</div>
);
}