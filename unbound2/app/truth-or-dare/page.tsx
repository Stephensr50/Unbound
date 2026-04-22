"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
truth_dare_enabled: boolean;
truth_dare_mode: "truth" | "dare" | "both";
};

type RequestActor = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

type RequestRow = {
id: number;
sender_id: string;
receiver_id: string;
type: "truth" | "dare" | "choice";
status: "pending" | "accepted" | "completed" | "declined";
created_at: string;
sender?: RequestActor | RequestActor[] | null;
receiver?: RequestActor | RequestActor[] | null;
};

type GameSessionRow = {
id: number;
request_id?: number | null;
user_a: string;
user_b: string;
type: "truth" | "dare" | "choice";
status: string;
created_at?: string;
};

function timeAgo(ts: string) {
if (typeof window === "undefined") return "";

const now = Date.now();
const then = new Date(ts).getTime();
const diff = Math.max(1, Math.floor((now - then) / 1000));

if (diff < 15) return "just now";
if (diff < 60) return `${diff}s`;
if (diff < 3600) return `${Math.floor(diff / 60)}m`;
if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
return `${Math.floor(diff / 86400)}d`;
}

function modeLabel(mode: "truth" | "dare" | "both") {
if (mode === "truth") return "Truth only";
if (mode === "dare") return "Dares welcome";
return "Truth + Dare";
}

function avatarFallback(name: string) {
return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function firstActor(
actor?: RequestActor | RequestActor[] | null
): RequestActor | null {
if (!actor) return null;
if (Array.isArray(actor)) return actor[0] ?? null;
return actor;
}

function statusChipStyle(
status: "pending" | "accepted" | "completed" | "declined"
): CSSProperties {
const base: CSSProperties = {
display: "inline-flex",
alignItems: "center",
padding: "8px 14px",
borderRadius: 999,
fontSize: 12,
fontWeight: 800,
color: "white",
textTransform: "capitalize",
};

if (status === "pending") {
return {
...base,
border: "2px solid rgba(236,72,153,0.85)",
background: "rgba(236,72,154,0.17)",
boxShadow:
"0 0 10px rgba(236,72,153,0.25), 0 0 20px rgba(192,38,211,0.18)",
};
}

if (status === "accepted") {
return {
...base,
border: "2px solid rgba(192,38,211,0.85)",
background: "rgba(168,85,247,0.18)",
boxShadow:
"0 0 10px rgba(168,85,247,0.25), 0 0 20px rgba(192,38,211,0.18)",
};
}

if (status === "completed") {
return {
...base,
border: "2px solid rgba(34,197,94,0.75)",
background: "rgba(34,197,94,0.14)",
boxShadow: "0 0 12px rgba(34,197,94,0.18)",
};
}

return {
...base,
border: "2px solid rgba(239,68,68,0.7)",
background: "rgba(239,68,68,0.14)",
boxShadow: "0 0 12px rgba(239,68,68,0.14)",
};
}

function modeChipStyle(mode: "truth" | "dare" | "both"): CSSProperties {
if (mode === "truth") {
return {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
fontWeight: 700,
boxShadow: "0 0 14px rgba(168,85,247,0.35)",
};
}

if (mode === "dare") {
return {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.95)",
background:
"linear-gradient(180deg, rgba(240, 32, 139, 0.95), rgba(192,38,211,0.85))",
color: "white",
fontWeight: 800,
boxShadow:
"0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)",
};
}

return {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.95)",
background:
"linear-gradient(180deg, rgba(240, 32, 139, 0.95), rgba(192,38,211,0.85))",
color: "white",
fontWeight: 800,
boxShadow:
"0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)",
};
}

export default function TruthOrDarePage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [me, setMe] = useState<string | null>(null);

const [players, setPlayers] = useState<ProfileRow[]>([]);
const [incoming, setIncoming] = useState<RequestRow[]>([]);
const [outgoing, setOutgoing] = useState<RequestRow[]>([]);

const [loading, setLoading] = useState(true);
const [savingPrefs, setSavingPrefs] = useState(false);
const [sending, setSending] = useState(false);
const [actingId, setActingId] = useState<number | null>(null);

const [search, setSearch] = useState("");
const [filter, setFilter] = useState<"all" | "truth" | "dare" | "both">(
"all"
);

const [myEnabled, setMyEnabled] = useState(false);
const [myMode, setMyMode] = useState<"truth" | "dare" | "both">("both");

const [selected, setSelected] = useState<ProfileRow | null>(null);
const [error, setError] = useState<string | null>(null);
const [notice, setNotice] = useState<string | null>(null);

async function loadEverything() {
setLoading(true);
setError(null);

const {
data: { session },
error: sessionError,
} = await supabase.auth.getSession();

if (sessionError) {
setError(sessionError.message);
setLoading(false);
return;
}

const userId = session?.user?.id ?? null;
setMe(userId);

if (!userId) {
setError("You need to be signed in to use Truth or Dare.");
setLoading(false);
return;
}

const { data: myProfile, error: myProfileError } = await supabase
.from("profiles")
.select("id, truth_dare_enabled, truth_dare_mode")
.eq("id", userId)
.single();

if (myProfileError) {
setError(myProfileError.message);
setLoading(false);
return;
}

setMyEnabled(!!myProfile.truth_dare_enabled);
setMyMode(
(myProfile.truth_dare_mode || "both") as "truth" | "dare" | "both"
);

const { data: playersData, error: playersError } = await supabase
.from("profiles")
.select(
"id, username, display_name, avatar_url, truth_dare_enabled, truth_dare_mode"
)
.eq("truth_dare_enabled", true)
.neq("id", userId)
.order("display_name", { ascending: true });

if (playersError) {
setError(playersError.message);
setLoading(false);
return;
}

setPlayers((playersData || []) as ProfileRow[]);

const { data: incomingData, error: incomingError } = await supabase
.from("truth_dare_requests")
.select(`
id,
sender_id,
receiver_id,
type,
status,
created_at,
sender:profiles!truth_dare_requests_sender_id_fkey (
id, username, display_name, avatar_url
),
receiver:profiles!truth_dare_requests_receiver_id_fkey (
id, username, display_name, avatar_url
)
`)
.eq("receiver_id", userId)
.order("created_at", { ascending: false })
.limit(20);

if (incomingError) {
setError(incomingError.message);
setLoading(false);
return;
}

const { data: outgoingData, error: outgoingError } = await supabase
.from("truth_dare_requests")
.select(`
id,
sender_id,
receiver_id,
type,
status,
created_at,
sender:profiles!truth_dare_requests_sender_id_fkey (
id, username, display_name, avatar_url
),
receiver:profiles!truth_dare_requests_receiver_id_fkey (
id, username, display_name, avatar_url
)
`)
.eq("sender_id", userId)
.order("created_at", { ascending: false })
.limit(20);

if (outgoingError) {
setError(outgoingError.message);
setLoading(false);
return;
}

setIncoming(((incomingData ?? []) as unknown) as RequestRow[]);
setOutgoing(((outgoingData ?? []) as unknown) as RequestRow[]);
setLoading(false);
}

useEffect(() => {
loadEverything();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

async function saveMyPrefs(
nextEnabled: boolean,
nextMode: "truth" | "dare" | "both"
) {
if (!me) return;

setSavingPrefs(true);
setError(null);
setNotice(null);

const { error: updateError } = await supabase
.from("profiles")
.update({
truth_dare_enabled: nextEnabled,
truth_dare_mode: nextMode,
})
.eq("id", me);

setSavingPrefs(false);

if (updateError) {
setError(updateError.message);
return;
}

setMyEnabled(nextEnabled);
setMyMode(nextMode);
setNotice("Your Truth or Dare settings were saved.");
await loadEverything();
}

async function sendRequest(type: "truth" | "dare" | "choice") {
if (!me || !selected) return;

setSending(true);
setError(null);
setNotice(null);

const { error: insertError } = await supabase
.from("truth_dare_requests")
.insert({
sender_id: me,
receiver_id: selected.id,
type,
status: "pending",
});

setSending(false);

if (insertError) {
setError(insertError.message);
return;
}

setNotice(
`Sent ${
type === "choice" ? "a Truth or Dare request" : `a ${type}`
} to ${selected.display_name || selected.username || "that player"}.`
);
setSelected(null);
await loadEverything();
}

async function updateRequestStatus(
requestId: number,
status: "accepted" | "declined"
) {
setActingId(requestId);
setError(null);
setNotice(null);

const { data: updated, error: updateError } = await supabase
.from("truth_dare_requests")
.update({ status })
.eq("id", requestId)
.select()
.single();

setActingId(null);

if (updateError || !updated) {
setError(updateError?.message || "Failed to update request.");
return;
}

if (status === "accepted") {
const request = updated as RequestRow;

const { data: existingSession, error: existingError } = await supabase
.from("game_sessions")
.select("id")
.eq("request_id", request.id)
.maybeSingle();

if (existingError) {
setError(existingError.message);
return;
}

if (existingSession?.id) {
router.push(`/truth-or-dare/${existingSession.id}`);
return;
}

const { data: sessionRow, error: sessionErr } = await supabase
.from("game_sessions")
.insert({
request_id: request.id,
user_a: request.sender_id,
user_b: request.receiver_id,
type: request.type,
status: "active",
})
.select()
.single();

if (sessionErr || !sessionRow) {
setError(sessionErr?.message || "Failed to start game.");
return;
}

router.push(`/truth-or-dare/${(sessionRow as GameSessionRow).id}`);
return;
}

setNotice("Request declined.");
await loadEverything();
}

async function openAcceptedRequest(request: RequestRow) {
setActingId(request.id);
setError(null);
setNotice(null);

const { data: existingSession, error: findError } = await supabase
.from("game_sessions")
.select("id")
.eq("request_id", request.id)
.maybeSingle();

if (findError) {
setActingId(null);
setError(findError.message);
return;
}

if (existingSession?.id) {
setActingId(null);
router.push(`/truth-or-dare/${existingSession.id}`);
return;
}

const { data: createdSession, error: createError } = await supabase
.from("game_sessions")
.insert({
request_id: request.id,
user_a: request.sender_id,
user_b: request.receiver_id,
type: request.type,
status: "active",
})
.select("id")
.single();

setActingId(null);

if (createError || !createdSession) {
setError(createError?.message || "Failed to open game.");
return;
}

router.push(`/truth-or-dare/${createdSession.id}`);
}

const filteredPlayers = useMemo(() => {
const q = search.trim().toLowerCase();

return players.filter((p) => {
const name = (p.display_name || "").toLowerCase();
const user = (p.username || "").toLowerCase();

const matchesSearch = !q || name.includes(q) || user.includes(q);

const matchesFilter =
filter === "all" ||
p.truth_dare_mode === filter ||
(filter !== "both" && p.truth_dare_mode === "both");

return matchesSearch && matchesFilter;
});
}, [players, search, filter]);

const wrapper: React.CSSProperties = {
width: "min(920px, 94vw)",
margin: "16px auto 0",
color: "white",
};

const profileCard: React.CSSProperties = {
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(236,72,153,0.95)",
borderRadius: 18,
padding: 18,
marginBottom: 18,
boxShadow:
"0 0 18px rgba(236,72,153,0.25), 0 0 40px rgba(192,38,211,0.15)",
};

const card: React.CSSProperties = {
background: "rgba(0,0,0,0.55)",
border: "2px solid rgba(180,120,255,0.16)",
borderRadius: 16,
padding: 14,
transition: "all 0.18s ease",
};

const inputStyle: React.CSSProperties = {
background: "rgba(0,0,0,0.6)",
color: "white",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 12,
padding: "12px 14px",
outline: "none",
width: "100%",
};

const countPill: React.CSSProperties = {
padding: "8px 14px",
borderRadius: 999,
border: "2px solid rgba(236,72,153,0.85)",
background: "rgba(236, 72, 154, 0.17)",
cursor: "pointer",
color: "white",
fontWeight: 700,
boxShadow:
"0 0 10px rgba(236,72,153,0.25), 0 0 20px rgba(192,38,211,0.18)",
};

const tabBtn = (active: boolean): React.CSSProperties => ({
padding: "9px 16px",
borderRadius: 999,
border: active
? "1px solid rgba(236,72,153,0.95)"
: "1px solid rgba(180,120,255,0.25)",
background: active
? "linear-gradient(180deg, rgba(240, 32, 139, 0.95), rgba(192,38,211,0.85))"
: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 800,
boxShadow: active
? "0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)"
: undefined,
transition: "transform 0.18s ease, box-shadow 0.18s ease",
});

const pillBtn: React.CSSProperties = {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 650,
};

const actionBtn: React.CSSProperties = {
padding: "10px 16px",
borderRadius: 999,
border: "none",
cursor: "pointer",
color: "white",
fontWeight: 700,
background: "linear-gradient(90deg,#7c3aed,#c026d3)",
boxShadow: "0 0 14px rgba(168,85,247,0.6)",
};

const mediaTile: React.CSSProperties = {
position: "relative",
borderRadius: 16,
overflow: "hidden",
border: "2px solid rgba(236,72,153,0.35)",
background: "rgba(20,0,20,0.55)",
cursor: "pointer",
transition: "all 0.18s ease",
boxShadow: "0 0 18px rgba(192,38,211,0.22)",
};

return (
<div style={wrapper}>
{error ? (
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
{error}
</div>
) : null}

{notice ? (
<div
style={{
marginBottom: 12,
padding: 10,
borderRadius: 14,
background: "rgba(48,10,60,0.45)",
border: "1px solid rgba(236,72,153,0.35)",
color: "rgba(255,235,250,0.96)",
fontSize: 13,
boxShadow:
"0 0 12px rgba(236,72,153,0.14), 0 0 24px rgba(168,85,247,0.10)",
}}
>
{notice}
</div>
) : null}

<div style={profileCard}>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 14,
flexWrap: "wrap",
alignItems: "flex-start",
}}
>
<div style={{ minWidth: 220, flex: 1 }}>
<div
style={{
fontSize: 24,
fontWeight: 850,
}}
>
Truth or Dare
</div>

<div style={{ opacity: 0.9, marginTop: 8, whiteSpace: "pre-wrap" }}>
Browse the grid, pick your player, and send a Truth, Dare, or let
them choose.
</div>
</div>

<Link
href="/game"
style={{
...countPill,
textDecoration: "none",
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
}}
>
Back to Kinky Games
</Link>
</div>
</div>

<div style={profileCard}>
<div
style={{
display: "grid",
gridTemplateColumns: "1.4fr 1fr",
gap: 14,
}}
>
<div style={card}>
<div
style={{
opacity: 0.72,
fontSize: 13,
marginBottom: 8,
fontWeight: 700,
}}
>
Search players
</div>
<input
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search display name or username"
style={inputStyle}
/>
</div>

<div style={card}>
<div
style={{
opacity: 0.72,
fontSize: 13,
marginBottom: 8,
fontWeight: 700,
}}
>
Filter
</div>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
{(["all", "truth", "dare", "both"] as const).map((opt) => (
<button
key={opt}
onClick={() => setFilter(opt)}
type="button"
style={tabBtn(filter === opt)}
onMouseEnter={(e) => {
e.currentTarget.style.transform = "scale(1.08)";
}}
onMouseLeave={(e) => {
e.currentTarget.style.transform = "scale(1)";
}}
>
{opt === "all"
? "All"
: opt === "both"
? "Both"
: opt[0].toUpperCase() + opt.slice(1)}
</button>
))}
</div>
</div>
</div>

<div style={{ ...card, marginTop: 14 }}>
<div
style={{
opacity: 0.72,
fontSize: 13,
marginBottom: 10,
fontWeight: 700,
}}
>
Your participation
</div>

<div
style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
>
<button
disabled={savingPrefs}
onClick={() => saveMyPrefs(!myEnabled, myMode)}
type="button"
style={myEnabled ? countPill : pillBtn}
>
{savingPrefs
? "Saving..."
: myEnabled
? "You are visible in the grid"
: "Tap to join the grid"}
</button>

<select
value={myMode}
disabled={savingPrefs}
onChange={(e) =>
saveMyPrefs(myEnabled, e.target.value as "truth" | "dare" | "both")
}
style={{
...inputStyle,
width: 160,
padding: "10px 12px",
}}
>
<option value="truth">Truth only</option>
<option value="dare">Dares welcome</option>
<option value="both">Truth + Dare</option>
</select>

<div style={modeChipStyle(myMode)}>{modeLabel(myMode)}</div>
</div>
</div>
</div>

<div
style={{
opacity: 0.95,
fontSize: 13,
marginBottom: 10,
fontWeight: 700,
color: "rgba(236,72,153,0.85)",
letterSpacing: 0.3,
}}
>
{loading ? "Loading players..." : `${filteredPlayers.length} players found`}
</div>

{filteredPlayers.length > 0 ? (
<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
gap: 14,
marginBottom: 18,
}}
>
{filteredPlayers.map((player) => {
const name = player.display_name || player.username || "Unknown";
const user = player.username ? `@${player.username}` : "No username";

return (
<button
key={player.id}
onClick={() => setSelected(player)}
type="button"
style={{
...mediaTile,
padding: 10,
aspectRatio: "auto",
textAlign: "left",
}}
onMouseEnter={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(-10px) scale(1.04)";
el.style.borderColor = "rgba(236,72,153,0.95)";
el.style.boxShadow =
"0 24px 50px rgba(0,0,0,0.45), 0 0 22px rgba(236,72,153,0.55), 0 0 55px rgba(192,38,211,0.55), 0 0 90px rgba(168,85,247,0.30)";
}}
onMouseLeave={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(0) scale(1)";
el.style.borderColor = "rgba(236,72,153,0.35)";
el.style.boxShadow = "0 0 18px rgba(192,38,211,0.22)";
}}
title={`Send Truth or Dare to ${name}`}
>
{player.avatar_url ? (
<img
src={player.avatar_url}
alt={name}
style={{
width: "100%",
aspectRatio: "1 / 1",
objectFit: "cover",
borderRadius: 14,
display: "block",
border: "1px solid rgba(255,255,255,0.16)",
}}
/>
) : (
<div
style={{
width: "100%",
aspectRatio: "1 / 1",
borderRadius: 14,
display: "grid",
placeItems: "center",
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(255,255,255,0.04)",
fontWeight: 900,
fontSize: 34,
opacity: 0.88,
}}
>
{avatarFallback(name)}
</div>
)}

<div style={{ padding: 10 }}>
<div style={{ fontWeight: 800, fontSize: 15 }}>{name}</div>

<div style={{ opacity: 0.72, fontSize: 13, marginTop: 4 }}>
{user}
</div>

<div style={{ marginTop: 10 }}>
<div style={modeChipStyle(player.truth_dare_mode)}>
{modeLabel(player.truth_dare_mode)}
</div>
</div>
</div>
</button>
);
})}
</div>
) : (
!loading && (
<div
style={{
...card,
marginBottom: 18,
opacity: 0.9,
fontSize: 14,
color: "rgba(255,230,245,0.95)",
textAlign: "center",
fontWeight: 700,
}}
>
No one’s playing right now… be the first 😈
</div>
)
)}

<div
style={{
display: "grid",
gridTemplateColumns: "1fr 1fr",
gap: 14,
}}
>
<div style={profileCard}>
<div style={{ fontSize: 22, fontWeight: 850, marginBottom: 12 }}>
Incoming requests
</div>

<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{incoming.length === 0 ? (
<div style={{ opacity: 0.72 }}>No requests yet.</div>
) : (
incoming.map((r) => {
const sender = firstActor(r.sender);
const senderName =
sender?.display_name || sender?.username || "Someone";

return (
<div
key={r.id}
style={card}
onMouseEnter={(e) => {
e.currentTarget.style.transform = "translateY(-4px)";
e.currentTarget.style.boxShadow =
"0 16px 30px rgba(0,0,0,0.30), 0 0 18px rgba(236,72,153,0.16)";
}}
onMouseLeave={(e) => {
e.currentTarget.style.transform = "translateY(0)";
e.currentTarget.style.boxShadow = "none";
}}
>
<div style={{ fontWeight: 800 }}>
{senderName} sent you{" "}
{r.type === "choice"
? "a Truth or Dare request"
: `a ${r.type}`}
</div>

<div
style={{
display: "flex",
gap: 8,
flexWrap: "wrap",
alignItems: "center",
marginTop: 8,
}}
>
<div style={statusChipStyle(r.status)}>{r.status}</div>
<div style={{ opacity: 0.65, fontSize: 12 }}>
{timeAgo(r.created_at)}
</div>
</div>

{r.status === "pending" ? (
<div
style={{
display: "flex",
gap: 10,
flexWrap: "wrap",
marginTop: 12,
}}
>
<button
onClick={() => updateRequestStatus(r.id, "accepted")}
disabled={actingId === r.id}
type="button"
style={actionBtn}
>
{actingId === r.id ? "Working..." : "Accept"}
</button>

<button
onClick={() => updateRequestStatus(r.id, "declined")}
disabled={actingId === r.id}
type="button"
style={pillBtn}
>
{actingId === r.id ? "Working..." : "Decline"}
</button>
</div>
) : r.status === "accepted" ? (
<div
style={{
display: "flex",
gap: 10,
flexWrap: "wrap",
marginTop: 12,
}}
>
<button
onClick={() => openAcceptedRequest(r)}
disabled={actingId === r.id}
type="button"
style={actionBtn}
>
{actingId === r.id ? "Opening..." : "Open game"}
</button>
</div>
) : null}
</div>
);
})
)}
</div>
</div>

<div style={profileCard}>
<div style={{ fontSize: 22, fontWeight: 850, marginBottom: 12 }}>
Outgoing requests
</div>

<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{outgoing.length === 0 ? (
<div style={{ opacity: 0.72 }}>
You have not sent any requests yet.
</div>
) : (
outgoing.map((r) => {
const receiver = firstActor(r.receiver);
const receiverName =
receiver?.display_name || receiver?.username || "Someone";

return (
<div
key={r.id}
style={card}
onMouseEnter={(e) => {
e.currentTarget.style.transform = "translateY(-4px)";
e.currentTarget.style.boxShadow =
"0 16px 30px rgba(0,0,0,0.30), 0 0 18px rgba(168,85,247,0.16)";
}}
onMouseLeave={(e) => {
e.currentTarget.style.transform = "translateY(0)";
e.currentTarget.style.boxShadow = "none";
}}
>
<div style={{ fontWeight: 800 }}>
You sent {receiverName}{" "}
{r.type === "choice"
? "a Truth or Dare request"
: `a ${r.type}`}
</div>

<div
style={{
display: "flex",
gap: 8,
flexWrap: "wrap",
alignItems: "center",
marginTop: 8,
}}
>
<div style={statusChipStyle(r.status)}>{r.status}</div>
<div style={{ opacity: 0.65, fontSize: 12 }}>
{timeAgo(r.created_at)}
</div>
</div>

{r.status === "accepted" ? (
<div
style={{
display: "flex",
gap: 10,
flexWrap: "wrap",
marginTop: 12,
}}
>
<button
onClick={() => openAcceptedRequest(r)}
disabled={actingId === r.id}
type="button"
style={actionBtn}
>
{actingId === r.id ? "Opening..." : "Open game"}
</button>
</div>
) : null}
</div>
);
})
)}
</div>
</div>
</div>

{selected ? (
<div
onClick={() => setSelected(null)}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.72)",
display: "flex",
alignItems: "center",
justifyContent: "center",
zIndex: 9998,
padding: 16,
}}
>
<div
onClick={(e) => e.stopPropagation()}
style={{
width: "min(680px, 96vw)",
background: "rgba(0,0,0,0.88)",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 16,
padding: 14,
boxShadow:
"0 0 20px rgba(236,72,153,0.18), 0 0 40px rgba(192,38,211,0.12)",
}}
>
<div style={{ fontSize: 22, fontWeight: 850, marginBottom: 12 }}>
Send Truth or Dare
</div>

<div style={{ opacity: 0.84, marginBottom: 14 }}>
Send a request to{" "}
<span style={{ fontWeight: 800 }}>
{selected.display_name || selected.username || "this player"}
</span>
.
</div>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button
disabled={sending}
onClick={() => sendRequest("truth")}
type="button"
style={tabBtn(true)}
>
{sending ? "Sending..." : "Truth"}
</button>

<button
disabled={sending}
onClick={() => sendRequest("dare")}
type="button"
style={actionBtn}
>
{sending ? "Sending..." : "Dare"}
</button>

<button
disabled={sending}
onClick={() => sendRequest("choice")}
type="button"
style={countPill}
>
{sending ? "Sending..." : "Let them choose"}
</button>

<button
onClick={() => setSelected(null)}
type="button"
style={pillBtn}
>
Cancel
</button>
</div>
</div>
</div>
) : null}
</div>
);
}