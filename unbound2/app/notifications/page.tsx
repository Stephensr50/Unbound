"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type NotifRow = {
id: number;
user_id: string;
actor_id: string | null;
type: string;
entity_id: string | null;
title: string | null;
body: string | null;
href: string | null;
created_at: string;
read_at: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
return createClient(url, key);
}

function timeAgo(ts: string) {
const d = new Date(ts).getTime();
const diff = Date.now() - d;
const s = Math.floor(diff / 1000);
if (s < 10) return "just now";
if (s < 60) return `${s}s ago`;
const m = Math.floor(s / 60);
if (m < 60) return `${m}m ago`;
const h = Math.floor(m / 60);
if (h < 24) return `${h}h ago`;
const days = Math.floor(h / 24);
return `${days}d ago`;
}

export default function NotificationsPage() {
const supabase = useMemo(() => getSupabase(), []);
const [loading, setLoading] = useState(true);
const [rows, setRows] = useState<NotifRow[]>([]);
const [err, setErr] = useState<string | null>(null);

async function load() {
setErr(null);
setLoading(true);

const { data: ses } = await supabase.auth.getSession();
const uid = ses.session?.user?.id;
if (!uid) {
setRows([]);
setLoading(false);
return;
}

const { data, error } = await supabase
.from("notifications")
.select("*")
.eq("user_id", uid)
.order("created_at", { ascending: false })
.limit(50);

if (error) setErr(error.message);
setRows((data ?? []) as NotifRow[]);
setLoading(false);
}

async function markAllRead() {
const { data: ses } = await supabase.auth.getSession();
const uid = ses.session?.user?.id;
if (!uid) return;

await supabase
.from("notifications")
.update({ read_at: new Date().toISOString() })
.eq("user_id", uid)
.is("read_at", null);

await load();
}


useEffect(() => {
load();
markAllRead(); // auto-clear unread badge on open
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

return (
<main style={{ padding: "22px 16px", maxWidth: 900, margin: "0 auto" }}>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
<h1 style={{ fontSize: 22, marginBottom: 10 }}>Notifications</h1>

<button
onClick={markAllRead}
style={{
marginLeft: "auto",
padding: "8px 12px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(168,85,247,0.12)",
color: "rgba(168,85,247,1)",
fontFamily: '"Gloock", serif',
fontWeight: 800,
cursor: "pointer",
}}
>
Mark all read
</button>
</div>

<div
style={{
border: "1px solid rgba(255,255,255,0.12)",
borderRadius: 14,
padding: 14,
background: "rgba(0,0,0,0.35)",
}}
>
{loading ? (
<div style={{ opacity: 0.8 }}>Loading…</div>
) : err ? (
<div style={{ opacity: 0.9 }}>Error: {err}</div>
) : rows.length === 0 ? (
<div style={{ opacity: 0.8 }}>
No notifications yet. (We’ll start generating these next.)
</div>
) : (
rows.map((n) => (
<div
key={n.id}
style={{
padding: "12px 12px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.10)",
background:
n.read_at == null ? "rgba(168,85,247,0.10)" : "rgba(0,0,0,0.25)",
marginTop: 10,
cursor: n.href ? "pointer" : "default",
}}
onClick={() => {
if (n.href) window.location.href = n.href;
}}
>
<div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
<div style={{ fontWeight: 800 }}>
{n.title ?? prettyTitle(n.type)}
</div>
<div style={{ marginLeft: "auto", opacity: 0.75, fontSize: 12 }}>
{timeAgo(n.created_at)}
</div>
</div>
{n.body ? (
<div style={{ opacity: 0.9, fontSize: 14, marginTop: 4 }}>
{n.body}
</div>
) : null}
</div>
))
)}
</div>
</main>
);
}

function prettyTitle(type: string) {
if (type === "friend_request") return "Friend request";
if (type === "spank") return "Spank";
if (type === "comment") return "Comment";
return type.replaceAll("_", " ");
}