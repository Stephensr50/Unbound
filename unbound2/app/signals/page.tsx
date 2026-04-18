"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type SignalType = "interested" | "curious" | "would" | "crush";

type SignalRow = {
id: number;
sender_id: string;
receiver_id: string;
signal_type: SignalType;
created_at: string;
};

type ProfileMini = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

type SignalWithProfile = SignalRow & {
senderProfile: ProfileMini | null;
isMutual: boolean;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

function timeAgo(ts: string) {
const then = new Date(ts).getTime();
const now = Date.now();
const s = Math.max(0, Math.floor((now - then) / 1000));
if (s < 15) return "just now";
if (s < 60) return `${s}s`;
if (s < 3600) return `${Math.floor(s / 60)}m`;
if (s < 86400) return `${Math.floor(s / 3600)}h`;
return `${Math.floor(s / 86400)}d`;
}

function signalLabel(type: SignalType) {
if (type === "interested") return "💜 Interested";
if (type === "curious") return "👀 Curious";
if (type === "would") return "🔥 Would";
return "😈 Crush";
}

export default function SignalsPage() {
const supabase = useMemo(() => getSupabase(), []);

const [myUserId, setMyUserId] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
const [banner, setBanner] = useState<string | null>(null);
const [signals, setSignals] = useState<SignalWithProfile[]>([]);

useEffect(() => {
(async () => {
setLoading(true);
setBanner(null);

const { data: authData } = await supabase.auth.getSession();
const uid = authData.session?.user?.id ?? null;
setMyUserId(uid);
if (uid) {
await supabase
.from("user_signals")
.update({ read_at: new Date().toISOString() })
.eq("receiver_id", uid)
.is("read_at", null);
}

if (!uid) {
setBanner("You need to be signed in to view signals.");
setSignals([]);
setLoading(false);
return;
}

const { data: incomingRows, error: incomingError } = await supabase
.from("user_signals")
.select("id,sender_id,receiver_id,signal_type,created_at")
.eq("receiver_id", uid)
.order("created_at", { ascending: false });

if (incomingError) {
setBanner(incomingError.message);
setSignals([]);
setLoading(false);
return;
}

const incoming = (incomingRows ?? []) as SignalRow[];

if (!incoming.length) {
setSignals([]);
setLoading(false);
return;
}

const senderIds = Array.from(new Set(incoming.map((r) => r.sender_id)));

const { data: profileRows, error: profileError } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", senderIds);

if (profileError) {
setBanner(profileError.message);
setSignals([]);
setLoading(false);
return;
}

const { data: myOutgoingRows, error: outgoingError } = await supabase
.from("user_signals")
.select("receiver_id")
.eq("sender_id", uid)
.in("receiver_id", senderIds);

if (outgoingError) {
setBanner(outgoingError.message);
setSignals([]);
setLoading(false);
return;
}

const profilesById: Record<string, ProfileMini> = {};
for (const p of (profileRows ?? []) as ProfileMini[]) {
profilesById[p.id] = p;
}

const outgoingSet = new Set(
(myOutgoingRows ?? []).map((r: any) => String(r.receiver_id))
);

const merged: SignalWithProfile[] = incoming.map((row) => ({
...row,
senderProfile: profilesById[row.sender_id] ?? null,
isMutual: outgoingSet.has(row.sender_id),
}));

setSignals(merged);
setLoading(false);
})();
}, [supabase]);

const sectionOrder: SignalType[] = ["crush", "would", "curious", "interested"];

const grouped: Record<SignalType, SignalWithProfile[]> = {
crush: [],
would: [],
curious: [],
interested: [],
};

for (const signal of signals) {
grouped[signal.signal_type].push(signal);
}

const pageWrap: React.CSSProperties = {
width: "min(920px, 94vw)",
margin: "96px auto 24px",
color: "white",
};

const card: React.CSSProperties = {
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(180,120,255,0.16)",
borderRadius: 18,
padding: 16,
marginBottom: 16,
};

const rowCard: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 12,
padding: 12,
borderRadius: 16,
border: "1px solid rgba(180,120,255,0.14)",
background: "rgba(0,0,0,0.28)",
textDecoration: "none",
color: "white",
};

const badge: React.CSSProperties = {
padding: "6px 10px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.45)",
background: "rgba(236,72,153,0.16)",
color: "rgba(255,230,245,0.98)",
fontSize: 12,
fontWeight: 800,
boxShadow: "0 0 14px rgba(236,72,153,0.18)",
};

return (
<div style={pageWrap}>
<div style={{ marginBottom: 18 }}>
<div style={{ fontSize: 34, fontWeight: 900, marginBottom: 6 }}>Signals</div>
<div style={{ opacity: 0.78 }}>
Quietly collected signals live here. Mutuals are where the magic happens.
</div>
</div>

{banner ? (
<div
style={{
marginBottom: 12,
padding: 10,
borderRadius: 14,
background: "rgba(120,0,0,0.35)",
border: "1px solid rgba(255,80,80,0.35)",
color: "rgba(255,220,220,0.95)",
fontSize: 13,
}}
>
{banner}
</div>
) : null}

{loading ? (
<div style={card}>Loading signals…</div>
) : signals.length === 0 ? (
<div style={card}>
<div style={{ fontSize: 20, fontWeight: 850, marginBottom: 8 }}>
No signals yet
</div>
<div style={{ opacity: 0.76 }}>
When people send you Interested, Curious, Would, or Crush, they’ll show up
here.
</div>
</div>
) : (
sectionOrder.map((type) => {
const items = grouped[type];
if (!items.length) return null;

return (
<div key={type} style={card}>
<div
style={{
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 12,
marginBottom: 12,
flexWrap: "wrap",
}}
>
<div style={{ fontSize: 22, fontWeight: 850 }}>
{signalLabel(type)}
</div>
<div style={badge}>{items.length}</div>
</div>

<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{items.map((item) => {
const p = item.senderProfile;
const name = p?.display_name || p?.username || "Unknown";

return (
<Link key={item.id} href={`/u/${item.sender_id}`} style={rowCard}>
{p?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={p.avatar_url}
alt=""
style={{
width: 52,
height: 52,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.16)",
flex: "0 0 auto",
}}
/>
) : (
<div
style={{
width: 52,
height: 52,
borderRadius: 999,
display: "grid",
placeItems: "center",
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(255,255,255,0.04)",
fontWeight: 800,
opacity: 0.75,
flex: "0 0 auto",
}}
>
{name.charAt(0).toUpperCase()}
</div>
)}

<div style={{ minWidth: 0, flex: 1 }}>
<div style={{ fontWeight: 850, marginBottom: 2 }}>{name}</div>
{p?.username ? (
<div style={{ opacity: 0.72, fontSize: 13, marginBottom: 4 }}>
@{p.username}
</div>
) : null}
<div style={{ opacity: 0.8, fontSize: 13 }}>
Sent {signalLabel(item.signal_type)} · {timeAgo(item.created_at)}
</div>
</div>

<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
{item.isMutual ? <div style={badge}>🔥 Mutual</div> : null}
<div style={{ opacity: 0.62, fontSize: 13 }}>View →</div>
</div>
</Link>
);
})}
</div>
</div>
);
})
)}
</div>
);
}