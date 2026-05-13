"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type EventType =
| "meetup"
| "party"
| "class"
| "workshop"
| "munch"
| "convention"
| "online"
| "other";

type EventVisibility = "public" | "private" | "friends" | "invite_only";
type RSVPVisibility = "public" | "attendees" | "hidden";
type EventStatus = "active" | "cancelled";

type EventRow = {
id: number;
creator_id: string;
title: string;
description: string | null;
location: string | null;
city: string | null;
state: string | null;
starts_at: string;
ends_at: string | null;
event_type: EventType;
visibility: EventVisibility;
rsvp_visibility: RSVPVisibility;
banner_url: string | null;
status: EventStatus;
creator?: {
username: string | null;
display_name: string | null;
avatar_url: string | null;
} | null;
};

type RSVPRow = {
id: number;
user_id: string;
status: "going" | "interested" | "not_going";
profiles?: {
username: string | null;
display_name: string | null;
avatar_url: string | null;
} | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

function formatDate(date: string) {
return new Date(date).toLocaleString([], {
weekday: "long",
month: "long",
day: "numeric",
year: "numeric",
hour: "numeric",
minute: "2-digit",
});
}

function labelFromValue(value: string) {
return value.replaceAll("_", " ").toUpperCase();
}

export default function EventDetailPage() {
const params = useParams();
const router = useRouter();
const eventId = Number(params.id);
const supabase = useMemo(() => getSupabase(), []);

const [meId, setMeId] = useState<string | null>(null);
const [event, setEvent] = useState<EventRow | null>(null);
const [rsvps, setRsvps] = useState<RSVPRow[]>([]);
const [myStatus, setMyStatus] = useState<
"going" | "interested" | "not_going" | null
>(null);
const [loading, setLoading] = useState(true);
const [savingStatus, setSavingStatus] = useState(false);
const [canceling, setCanceling] = useState(false);

useEffect(() => {
loadPage();
}, [eventId]);

async function loadPage() {
setLoading(true);

const {
data: { user },
} = await supabase.auth.getUser();

setMeId(user?.id || null);

const { data: eventData, error: eventError } = await supabase
.from("events")
.select(
`
*,
creator:profiles (
username,
display_name,
avatar_url
)
`
)
.eq("id", eventId)
.single();

if (eventError) {
console.error(eventError);
setEvent(null);
setLoading(false);
return;
}

const loadedEvent = eventData as EventRow;
setEvent(loadedEvent);

const { data: rsvpData, error: rsvpError } = await supabase
.from("event_rsvps")
.select(
`
id,
user_id,
status,
profiles (
username,
display_name,
avatar_url
)
`
)
.eq("event_id", eventId)
.neq("status", "not_going")
.order("created_at", { ascending: true });

if (rsvpError) {
console.error(rsvpError);
setRsvps([]);
} else {
const safeRsvps: RSVPRow[] = (rsvpData || []) as unknown as RSVPRow[];
setRsvps(safeRsvps);

if (user?.id) {
const mine = safeRsvps.find((r) => r.user_id === user.id);
setMyStatus(mine?.status || null);
}
}

setLoading(false);
}

async function setRSVP(status: "going" | "interested" | "not_going") {
if (!meId || !event || event.status === "cancelled") return;

setSavingStatus(true);

const { error } = await supabase.from("event_rsvps").upsert(
{
event_id: eventId,
user_id: meId,
status,
updated_at: new Date().toISOString(),
},
{
onConflict: "event_id,user_id",
}
);

setSavingStatus(false);

if (error) {
console.error(error);
return;
}

setMyStatus(status);
await loadPage();
}

async function cancelEvent() {
if (!event) return;

const ok = window.confirm(
"Cancel this event? People will still be able to see it, but it will be marked cancelled."
);

if (!ok) return;

setCanceling(true);

const { error } = await supabase
.from("events")
.update({ status: "cancelled" })
.eq("id", event.id);

setCanceling(false);

if (error) {
console.error(error);
alert("Could not cancel event.");
return;
}

await loadPage();
}

if (loading) {
return (
<main style={{ maxWidth: 860, margin: "0 auto", padding: "120px 20px" }}>
<p style={{ color: "rgba(255,255,255,0.72)" }}>Loading event...</p>
</main>
);
}

if (!event) {
return (
<main style={{ maxWidth: 860, margin: "0 auto", padding: "120px 20px" }}>
<h1 style={{ color: "white" }}>Event not found</h1>
</main>
);
}

const hostName =
event.creator?.display_name || event.creator?.username || "Unknown host";

const going = rsvps.filter((r) => r.status === "going");
const interested = rsvps.filter((r) => r.status === "interested");

const isCreator = meId === event.creator_id;
const isAttendee =
!!meId &&
rsvps.some(
(r) =>
r.user_id === meId &&
(r.status === "going" || r.status === "interested")
);

const canSeeRSVPList =
event.rsvp_visibility === "public" ||
(event.rsvp_visibility === "attendees" && isAttendee) ||
(event.rsvp_visibility === "hidden" && isCreator);

return (
<main style={{ maxWidth: 900, margin: "0 auto", padding: "120px 20px 80px" }}>
<section style={cardStyle}>
{event.banner_url && (
<div style={bannerWrapStyle}>
<img src={event.banner_url} alt="" style={bannerImageStyle} />
</div>
)}

<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
{event.status === "cancelled" && (
<span style={cancelledPillStyle}>CANCELLED</span>
)}

<span style={pillStyle}>{labelFromValue(event.event_type)}</span>

{event.visibility !== "public" && (
<span style={pillStyle}>{labelFromValue(event.visibility)}</span>
)}

<span style={softPillStyle}>
RSVP: {labelFromValue(event.rsvp_visibility)}
</span>
</div>

<h1 style={{ color: "white", fontSize: 38, marginBottom: 10 }}>
{event.title}
</h1>

<p style={{ color: "rgba(255,255,255,0.72)", marginBottom: 18 }}>
Hosted by {hostName}
</p>

<div style={{ color: "rgba(255,255,255,0.84)", lineHeight: 1.8 }}>
<div>📅 {formatDate(event.starts_at)}</div>
{event.ends_at && <div>Ends: {formatDate(event.ends_at)}</div>}
{event.location && <div>📍 {event.location}</div>}
{(event.city || event.state) && (
<div>🌎 {[event.city, event.state].filter(Boolean).join(", ")}</div>
)}
</div>

{event.description && (
<p
style={{
marginTop: 22,
color: "rgba(255,255,255,0.82)",
lineHeight: 1.6,
whiteSpace: "pre-wrap",
}}
>
{event.description}
</p>
)}

{isCreator && (
<div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
<Link href={`/events/${event.id}/edit`} style={hostButtonStyle}>
Edit Event
</Link>

{event.status !== "cancelled" && (
<button
disabled={canceling}
onClick={cancelEvent}
style={dangerButtonStyle}
>
{canceling ? "Cancelling..." : "Cancel Event"}
</button>
)}
</div>
)}

<div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
<button
disabled={savingStatus || !meId || event.status === "cancelled"}
onClick={() => setRSVP("going")}
style={myStatus === "going" ? activeButtonStyle : buttonStyle}
>
Going
</button>

<button
disabled={savingStatus || !meId || event.status === "cancelled"}
onClick={() => setRSVP("interested")}
style={myStatus === "interested" ? activeButtonStyle : buttonStyle}
>
Interested
</button>

<button
disabled={savingStatus || !meId || event.status === "cancelled"}
onClick={() => setRSVP("not_going")}
style={buttonStyle}
>
Remove RSVP
</button>
</div>
</section>

<section style={rsvpCardStyle}>
<h2 style={{ color: "white", marginBottom: 14 }}>RSVPs</h2>

<p style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>
{going.length} going · {interested.length} interested
</p>

{!canSeeRSVPList ? (
<p style={{ color: "rgba(255,255,255,0.62)" }}>
The attendee list is private for this event.
</p>
) : rsvps.length === 0 ? (
<p style={{ color: "rgba(255,255,255,0.62)" }}>No RSVPs yet.</p>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{rsvps.map((rsvp) => {
const name =
rsvp.profiles?.display_name ||
rsvp.profiles?.username ||
"Unknown user";

return (
<div key={rsvp.id} style={rsvpRowStyle}>
<span>{name}</span>
<span>{rsvp.status}</span>
</div>
);
})}
</div>
)}
</section>
</main>
);
}

const cardStyle: React.CSSProperties = {
background: "rgba(255,255,255,0.05)",
border: "1px solid rgba(168,85,247,0.22)",
borderRadius: 26,
padding: 26,
backdropFilter: "blur(12px)",
boxShadow: "0 0 26px rgba(123,92,255,0.14)",
marginBottom: 22,
overflow: "hidden",
};

const bannerWrapStyle: React.CSSProperties = {
width: "100%",
height: 260,
borderRadius: 22,
overflow: "hidden",
marginBottom: 22,
border: "1px solid rgba(255,255,255,0.12)",
boxShadow: "0 0 28px rgba(123,92,255,0.18)",
};

const bannerImageStyle: React.CSSProperties = {
width: "100%",
height: "100%",
objectFit: "contain",
display: "block",
background: "rgba(0,0,0,0.45)",
};

const rsvpCardStyle: React.CSSProperties = {
background: "rgba(255,255,255,0.04)",
border: "1px solid rgba(255,255,255,0.09)",
borderRadius: 22,
padding: 22,
};

const pillStyle: React.CSSProperties = {
padding: "7px 11px",
borderRadius: 999,
background:
"linear-gradient(135deg, rgba(255,79,216,0.95), rgba(123,92,255,0.95))",
color: "white",
fontSize: 12,
fontWeight: 900,
letterSpacing: 0.6,
boxShadow: "0 0 18px rgba(168,85,247,0.35)",
};

const softPillStyle: React.CSSProperties = {
...pillStyle,
background: "rgba(255,255,255,0.07)",
border: "1px solid rgba(255,255,255,0.14)",
boxShadow: "none",
};

const cancelledPillStyle: React.CSSProperties = {
...pillStyle,
background: "rgba(239,68,68,0.88)",
boxShadow: "0 0 18px rgba(239,68,68,0.35)",
};

const rsvpRowStyle: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
padding: "12px 14px",
borderRadius: 16,
background: "rgba(0,0,0,0.25)",
color: "rgba(255,255,255,0.84)",
};

const buttonStyle: React.CSSProperties = {
padding: "11px 15px",
borderRadius: 14,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(255,255,255,0.06)",
color: "white",
fontWeight: 800,
cursor: "pointer",
};

const activeButtonStyle: React.CSSProperties = {
...buttonStyle,
border: "1px solid rgba(255,79,216,0.75)",
background: "linear-gradient(135deg, #ff4fd8 0%, #7b5cff 100%)",
boxShadow: "0 0 20px rgba(168,85,247,0.4)",
};

const hostButtonStyle: React.CSSProperties = {
...buttonStyle,
textDecoration: "none",
display: "inline-flex",
alignItems: "center",
};

const dangerButtonStyle: React.CSSProperties = {
...buttonStyle,
border: "1px solid rgba(239,68,68,0.45)",
background: "rgba(239,68,68,0.14)",
};