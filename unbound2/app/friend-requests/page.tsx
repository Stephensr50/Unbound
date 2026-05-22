"use client";

import { useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type FriendRequestRow = {
id: number;
from_user_id: string;
to_user_id: string;
status: string;
created_at: string;
};

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

function FriendRequestsPageContent() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();
const sp = useSearchParams();
const focusId = sp.get("id"); // optional: /friend-requests?id=123

const [me, setMe] = useState<string | null>(null);
const [rows, setRows] = useState<FriendRequestRow[]>([]);
const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
const [loading, setLoading] = useState(true);
const [err, setErr] = useState<string | null>(null);

async function load() {
setLoading(true);
setErr(null);

const { data: auth } = await supabase.auth.getUser();
const uid = auth.user?.id || null;
setMe(uid);
if (!uid) {
setErr("Not signed in.");
setLoading(false);
return;
}

const { data: fr, error: frErr } = await supabase
.from("friend_requests")
.select("id,from_user_id,to_user_id,status,created_at")
.eq("to_user_id", uid)
.eq("status", "pending")
.order("created_at", { ascending: false });

if (frErr) {
setErr(frErr.message);
setLoading(false);
return;
}

const list = (fr || []) as FriendRequestRow[];
setRows(list);

const fromIds = Array.from(new Set(list.map((r) => r.from_user_id)));
if (fromIds.length) {
const { data: profs } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", fromIds);

const map: Record<string, ProfileRow> = {};
(profs || []).forEach((p: any) => (map[p.id] = p));
setProfiles(map);
} else {
setProfiles({});
}

setLoading(false);
}

useEffect(() => {
load();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

async function setStatus(id: number, status: "accepted" | "declined") {
if (!me) return;
setErr(null);

const { error } = await supabase
.from("friend_requests")
.update({ status, responded_at: new Date().toISOString() })
.eq("id", id)
.eq("to_user_id", me);

if (error) {
setErr(error.message);
return;
}

// mark related notification as read
await supabase
.from("notifications")
.update({ read_at: new Date().toISOString() })
.eq("type", "friend_request")
.eq("entity_id", String(id))
.eq("user_id", me);

// Remove from list immediately
setRows((prev) => prev.filter((r) => r.id !== id));
}

return (
<div style={{ maxWidth: 820, margin: "0 auto", padding: "22px 16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
<button
onClick={() => router.back()}
style={{
borderRadius: 12,
padding: "8px 12px",
border: "1px solid rgba(168,85,247,0.25)",
background: "rgba(0,0,0,0.25)",
color: "rgba(255,255,255,0.92)",
cursor: "pointer",
}}
>
← Back
</button>
<h1 style={{ margin: 0, fontSize: 28 }}>Friend Requests</h1>
</div>

{err && (
<div
style={{
marginBottom: 12,
padding: "10px 12px",
borderRadius: 12,
border: "1px solid rgba(239,68,68,0.35)",
background: "rgba(239,68,68,0.12)",
}}
>
{err}
</div>
)}

{loading ? (
<div style={{ opacity: 0.8 }}>Loading…</div>
) : rows.length === 0 ? (
<div style={{ opacity: 0.75 }}>No pending requests.</div>
) : (
<div style={{ display: "grid", gap: 12 }}>
{rows.map((r) => {
const p = profiles[r.from_user_id];
const name = p?.display_name || p?.username || "Someone";
const avatar = p?.avatar_url;

const isFocus = focusId && String(r.id) === String(focusId);

return (
<div
key={r.id}
style={{
borderRadius: 16,
border: "1px solid rgba(168,85,247,0.22)",
background: isFocus ? "rgba(168,85,247,0.16)" : "rgba(255,255,255,0.06)",
padding: 14,
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 12,
}}
>
<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<div
style={{
width: 42,
height: 42,
borderRadius: 999,
background: "rgba(255,255,255,0.10)",
overflow: "hidden",
border: "1px solid rgba(255,255,255,0.12)",
flex: "0 0 auto",
}}
>
{avatar ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
) : null}
</div>
<div>
<div style={{ fontWeight: 700 }}>{name}</div>
<div style={{ fontSize: 12, opacity: 0.75 }}>wants to be friends</div>
</div>
</div>

<div style={{ display: "flex", gap: 10 }}>
<button
onClick={() => setStatus(r.id, "declined")}
style={{
borderRadius: 12,
padding: "10px 12px",
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(255,255,255,0.06)",
color: "rgba(255,255,255,0.90)",
cursor: "pointer",
}}
>
Decline
</button>
<button
onClick={() => setStatus(r.id, "accepted")}
style={{
borderRadius: 12,
padding: "10px 12px",
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(168,85,247,0.18)",
color: "rgba(255,255,255,0.95)",
cursor: "pointer",
}}
>
Accept
</button>
</div>
</div>
);
})}
</div>
)}
</div>
);
}
export default function FriendRequestPageContent() {
return (
<Suspense fallback={null}>
<FriendRequestsPageContent />
</Suspense>
);
}