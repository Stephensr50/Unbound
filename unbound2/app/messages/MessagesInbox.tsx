"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type InboxRow = {
id: number;
last_message_at: string | null;
messages: Array<{
id: number;
body: string | null;
created_at: string;
sender_id: string | null;
}>;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function MessagesInbox() {
const router = useRouter();
const searchParams = useSearchParams();
const supabase = useMemo(() => getSupabase(), []);

const [threads, setThreads] = useState<InboxRow[]>([]);
const [loading, setLoading] = useState(true);
const [err, setErr] = useState("");

const inFlightRef = useRef(false);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
return data.session?.user?.id ?? null;
}

async function loadInbox(opts?: { silent?: boolean }) {
const silent = opts?.silent ?? false;
if (inFlightRef.current) return;
inFlightRef.current = true;

try {
if (!silent) setLoading(true);
setErr("");

const uid = await refreshAuth();
if (!uid) {
setErr("Not signed in.");
setThreads([]);
return;
}

const { data, error } = await supabase
.from("conversations")
.select(`
id,
last_message_at,
messages:messages_conversation_id_fkey (
id,
body,
created_at,
sender_id
)
`)
.order("last_message_at", { ascending: false })
.limit(50);

if (error) throw error;

const rows = (data ?? []) as InboxRow[];

const normalized = rows.map((r) => {
const msgs = Array.isArray(r.messages) ? r.messages : [];
const newest = msgs
.slice()
.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
.slice(0, 1);
return { ...r, messages: newest };
});

setThreads(normalized);
} catch (e: any) {
console.error(e);
setErr(e?.message ?? "Inbox load failed.");
setThreads([]);
} finally {
if (!silent) setLoading(false);
inFlightRef.current = false;
}
}

useEffect(() => {
loadInbox();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchParams]);

if (loading) {
return (
<div style={{ padding: 16, opacity: 0.9 }}>
Loading messages…
</div>
);
}

if (err) {
return (
<div style={{ padding: 16 }}>
<div style={{ color: "#ffb3b3", marginBottom: 12 }}>{err}</div>

{/* SOLID PURPLE BUTTON — NO OUTLINE */}
<button
onClick={() => loadInbox()}
style={{
padding: "12px 18px",
borderRadius: 12,
border: "none",
outline: "none",
background: "linear-gradient(180deg,#a47aed,#49159e)",
color: "#f5edff",
fontWeight: 700,
cursor: "pointer",
boxShadow: "0 0 18px rgba(170,90,255,0.45)",
}}
>
Retry
</button>
</div>
);
}

return (
<div style={{ padding: 16 }}>
{threads.length === 0 ? (
<div style={{ opacity: 0.85 }}>No conversations yet.</div>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
{threads.map((t) => {
const last = t.messages?.[0];

return (
<button
key={t.id}
onClick={() => router.push(`/messages/${t.id}`)}
style={{
textAlign: "left",
padding: 16,
borderRadius: 14,
border: "none",
outline: "none",
background:
"linear-gradient(180deg, rgba(164,122,237,0.18), rgba(73,21,158,0.18))",
color: "#f5edff",
cursor: "pointer",
boxShadow: "0 0 14px rgba(170,90,255,0.25)",
}}
>
<div style={{ fontWeight: 700 }}>
Conversation #{t.id}
</div>

<div style={{ opacity: 0.9, marginTop: 6 }}>
{last?.body ?? "(no text)"}
</div>

<div style={{ opacity: 0.6, marginTop: 6, fontSize: 12 }}>
{t.last_message_at ?? ""}
</div>
</button>
);
})}
</div>
)}
</div>
);
}