"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type SignalType = "interested" | "curious" | "would" | "crush";
type TabType = "received" | "sent" | "mutual";

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

type SignalItem = SignalRow & {
profile: ProfileMini | null;
isMutual: boolean;
direction: "received" | "sent";
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
const router = useRouter();

const [myUserId, setMyUserId] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<TabType>("received");
const [loading, setLoading] = useState(true);
const [banner, setBanner] = useState<string | null>(null);
const [received, setReceived] = useState<SignalItem[]>([]);
const [sent, setSent] = useState<SignalItem[]>([]);

async function openMessageWithProfile(otherUserId: string) {
const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData.session?.access_token;

if (!token) {
setBanner("You need to be signed in to message.");
return;
}

const res = await fetch("/api/conversations/get-or-create", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${token}`,
},
body: JSON.stringify({
to: otherUserId,
}),
});

const json = await res.json();

if (!res.ok) {
setBanner(json?.error || "Could not open messages.");
return;
}

const conversationId = json.conversationId ?? json.conversation_id ?? json.id;

if (!conversationId) {
setBanner("Could not open messages.");
return;
}

router.push(`/messages/${conversationId}`);
}

useEffect(() => {
(async () => {
setLoading(true);
setBanner(null);

const { data: authData } = await supabase.auth.getSession();
const uid = authData.session?.user?.id ?? null;
setMyUserId(uid);

if (!uid) {
setBanner("You need to be signed in to view signals.");
setReceived([]);
setSent([]);
setLoading(false);
return;
}

await supabase
.from("user_signals")
.update({ read_at: new Date().toISOString() })
.eq("receiver_id", uid)
.is("read_at", null);

const [incomingRes, outgoingRes] = await Promise.all([
supabase
.from("user_signals")
.select("id,sender_id,receiver_id,signal_type,created_at")
.eq("receiver_id", uid)
.order("created_at", { ascending: false }),
supabase
.from("user_signals")
.select("id,sender_id,receiver_id,signal_type,created_at")
.eq("sender_id", uid)
.order("created_at", { ascending: false }),
]);

if (incomingRes.error) {
setBanner(incomingRes.error.message);
setLoading(false);
return;
}

if (outgoingRes.error) {
setBanner(outgoingRes.error.message);
setLoading(false);
return;
}

const incoming = (incomingRes.data ?? []) as SignalRow[];
const outgoing = (outgoingRes.data ?? []) as SignalRow[];

const profileIds = Array.from(
new Set([
...incoming.map((r) => r.sender_id),
...outgoing.map((r) => r.receiver_id),
])
);

let profilesById: Record<string, ProfileMini> = {};

if (profileIds.length) {
const { data: profileRows, error: profileError } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", profileIds);

if (profileError) {
setBanner(profileError.message);
setLoading(false);
return;
}

for (const p of (profileRows ?? []) as ProfileMini[]) {
profilesById[p.id] = p;
}
}

const outgoingReceiverSet = new Set(outgoing.map((r) => r.receiver_id));
const incomingSenderSet = new Set(incoming.map((r) => r.sender_id));

setReceived(
incoming.map((row) => ({
...row,
profile: profilesById[row.sender_id] ?? null,
isMutual: outgoingReceiverSet.has(row.sender_id),
direction: "received",
}))
);

setSent(
outgoing.map((row) => ({
...row,
profile: profilesById[row.receiver_id] ?? null,
isMutual: incomingSenderSet.has(row.receiver_id),
direction: "sent",
}))
);

setLoading(false);
})();
}, [supabase]);

const mutual = received.filter((item) => item.isMutual);

const visibleItems =
activeTab === "received" ? received : activeTab === "sent" ? sent : mutual;

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

const tabBtn = (active: boolean): React.CSSProperties => ({
padding: "9px 16px",
borderRadius: 999,
border: active
? "1px solid rgba(236,72,153,0.95)"
: "1px solid rgba(180,120,255,0.25)",
background: active
? "linear-gradient(180deg, rgba(240,32,139,0.95), rgba(192,38,211,0.85))"
: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 850,
boxShadow: active
? "0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)"
: undefined,
});

return (
<div style={pageWrap}>
<div style={{ marginBottom: 18 }}>
<div style={{ fontSize: 34, fontWeight: 900, marginBottom: 6 }}>
Signals
</div>
<div style={{ opacity: 0.78 }}>
Track who signaled you, who you signaled, and who matched back.
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

<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
<button onClick={() => setActiveTab("received")} style={tabBtn(activeTab === "received")}>
Received · {received.length}
</button>
<button onClick={() => setActiveTab("sent")} style={tabBtn(activeTab === "sent")}>
Sent · {sent.length}
</button>
<button onClick={() => setActiveTab("mutual")} style={tabBtn(activeTab === "mutual")}>
Mutual · {mutual.length}
</button>
</div>

{loading ? (
<div style={card}>Loading signals…</div>
) : visibleItems.length === 0 ? (
<div style={card}>
<div style={{ fontSize: 20, fontWeight: 850, marginBottom: 8 }}>
No signals here yet
</div>
<div style={{ opacity: 0.76 }}>
Signals will show up here once people start tapping Interested,
Curious, Would, or Crush.
</div>
</div>
) : (
<div style={card}>
<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{visibleItems.map((item) => {
const p = item.profile;
const otherUserId =
item.direction === "received" ? item.sender_id : item.receiver_id;
const name = p?.display_name || p?.username || "Unknown";

return (
<div key={`${item.direction}-${item.id}`} style={rowCard}>
<Link
href={`/u/${otherUserId}`}
style={{
display: "flex",
alignItems: "center",
gap: 12,
minWidth: 0,
flex: 1,
color: "white",
textDecoration: "none",
}}
>
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
{item.direction === "received" ? "Sent you" : "You sent"}{" "}
{signalLabel(item.signal_type)} · {timeAgo(item.created_at)}
</div>
</div>
</Link>

<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
{item.isMutual ? <div style={badge}>🔥 Mutual</div> : null}

{item.isMutual ? (
<button
type="button"
onClick={(e) => {
e.preventDefault();
e.stopPropagation();
void openMessageWithProfile(otherUserId);
}}
style={{
position: "relative",
zIndex: 999,
pointerEvents: "auto",
padding: "8px 12px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.35)",
background: "rgba(168,85,247,0.18)",
color: "white",
cursor: "pointer",
fontWeight: 800,
}}
>
Message
</button>
) : (
<Link
href={`/u/${otherUserId}`}
style={{ opacity: 0.62, fontSize: 13, color: "white" }}
>
View →
</Link>
)}
</div>
</div>
);
})}
</div>
</div>
)}
</div>
);
}