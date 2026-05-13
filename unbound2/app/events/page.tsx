"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type EventRow = {
id: number;
title: string;
description: string | null;
location: string | null;
city: string | null;
state: string | null;
starts_at: string;
ends_at: string | null;
creator_id: string;
event_type: string;
visibility: string;
rsvp_visibility: string;
event_rsvps?: { status: string }[];
creator?: {
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
weekday: "short",
month: "short",
day: "numeric",
hour: "numeric",
minute: "2-digit",
});
}

function labelFromValue(value: string | null | undefined) {
if (!value) return "";
return value.replaceAll("_", " ").toUpperCase();
}

function getDateBadge(dateString: string) {
const eventDate = new Date(dateString);
const now = new Date();

const today = new Date(now);
today.setHours(0, 0, 0, 0);

const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const dayAfterTomorrow = new Date(today);
dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

if (eventDate >= today && eventDate < tomorrow) return "TONIGHT";
if (eventDate >= tomorrow && eventDate < dayAfterTomorrow) return "TOMORROW";

return null;
}

export default function EventsPage() {
const supabase = useMemo(() => getSupabase(), []);
const [events, setEvents] = useState<EventRow[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
loadEvents();
}, []);

async function loadEvents() {
setLoading(true);

const { data, error } = await supabase
.from("events")
.select(`
*,
creator:profiles (
username,
display_name,
avatar_url
),
event_rsvps (
status
)
`)
.gte("starts_at", new Date().toISOString())
.order("starts_at", { ascending: true });

if (error) {
console.error(error);
setLoading(false);
return;
}

setEvents((data || []) as unknown as EventRow[]);
setLoading(false);
}

return (
<main style={{ maxWidth: 960, margin: "0 auto", padding: "120px 20px 80px" }}>
<style>{`
.eventCard {
transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}
.eventCard:hover {
transform: translateY(-2px);
border-color: rgba(255,79,216,0.45) !important;
box-shadow: 0 0 34px rgba(168,85,247,0.24) !important;
}
`}</style>

<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 18,
marginBottom: 28,
flexWrap: "wrap",
}}
>
<div>
<h1 style={{ fontSize: 38, fontWeight: 900, color: "white", marginBottom: 6 }}>
Events
</h1>
<p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>
Find munches, parties, classes, rope jams, and community gatherings.
</p>
</div>

<Link
href="/events/new"
style={{
padding: "12px 18px",
borderRadius: 14,
background: "linear-gradient(135deg, #ff4fd8 0%, #7b5cff 100%)",
color: "white",
textDecoration: "none",
fontWeight: 800,
boxShadow: "0 0 24px rgba(168,85,247,0.45)",
}}
>
+ Create Event
</Link>
</div>

{loading ? (
<div style={{ color: "rgba(255,255,255,0.7)" }}>Loading events...</div>
) : events.length === 0 ? (
<div
style={{
padding: 24,
borderRadius: 20,
background: "rgba(255,255,255,0.04)",
border: "1px solid rgba(255,255,255,0.08)",
color: "rgba(255,255,255,0.7)",
}}
>
No upcoming events yet.
</div>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
{events.map((event) => {
const creatorName =
event.creator?.display_name ||
event.creator?.username ||
"Unknown host";

const creatorInitial = creatorName.slice(0, 1).toUpperCase();

const going =
event.event_rsvps?.filter((r) => r.status === "going").length || 0;

const interested =
event.event_rsvps?.filter((r) => r.status === "interested").length || 0;

const place = [event.city, event.state].filter(Boolean).join(", ");
const dateBadge = getDateBadge(event.starts_at);

return (
<Link
key={event.id}
href={`/events/${event.id}`}
style={{ textDecoration: "none", color: "inherit" }}
>
<article
className="eventCard"
style={{
background: "rgba(255,255,255,0.05)",
border: "1px solid rgba(168,85,247,0.22)",
borderRadius: 24,
padding: 22,
backdropFilter: "blur(12px)",
boxShadow: "0 0 24px rgba(123,92,255,0.12)",
}}
>
<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
{dateBadge && <span style={hotPillStyle}>{dateBadge}</span>}

<span style={pillStyle}>{labelFromValue(event.event_type)}</span>

{event.visibility !== "public" && (
<span style={softPillStyle}>{labelFromValue(event.visibility)}</span>
)}

<span style={softPillStyle}>
{going} going · {interested} interested
</span>
</div>

<h2 style={{ color: "white", fontSize: 26, marginBottom: 10 }}>
{event.title}
</h2>

{event.description && (
<p
style={{
color: "rgba(255,255,255,0.76)",
lineHeight: 1.5,
marginBottom: 16,
}}
>
{event.description.length > 170
? `${event.description.slice(0, 170)}...`
: event.description}
</p>
)}

<div
style={{
display: "flex",
flexDirection: "column",
gap: 8,
color: "rgba(255,255,255,0.72)",
fontSize: 14,
marginBottom: 18,
}}
>
<div>📅 {formatDate(event.starts_at)}</div>

{event.ends_at && <div>Ends: {formatDate(event.ends_at)}</div>}

{(event.location || place) && (
<div>📍 {[event.location, place].filter(Boolean).join(" · ")}</div>
)}
</div>

<div
style={{
display: "flex",
alignItems: "center",
gap: 10,
color: "rgba(255,255,255,0.72)",
fontSize: 14,
}}
>
{event.creator?.avatar_url ? (
<img
src={event.creator.avatar_url}
alt=""
style={{
width: 34,
height: 34,
borderRadius: "50%",
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.18)",
}}
/>
) : (
<div
style={{
width: 34,
height: 34,
borderRadius: "50%",
display: "grid",
placeItems: "center",
background:
"linear-gradient(135deg, rgba(255,79,216,0.7), rgba(123,92,255,0.7))",
color: "white",
fontWeight: 900,
border: "1px solid rgba(255,255,255,0.18)",
}}
>
{creatorInitial}
</div>
)}

<span>Hosted by {creatorName}</span>
</div>
</article>
</Link>
);
})}
</div>
)}
</main>
);
}

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

const hotPillStyle: React.CSSProperties = {
...pillStyle,
background:
"linear-gradient(135deg, rgba(255,42,109,0.98), rgba(255,153,0,0.92))",
};

const softPillStyle: React.CSSProperties = {
...pillStyle,
background: "rgba(255,255,255,0.07)",
border: "1px solid rgba(255,255,255,0.14)",
boxShadow: "none",
};