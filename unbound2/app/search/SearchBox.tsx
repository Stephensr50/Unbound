"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
bio: string | null;
avatar_url: string | null;
city: string | null;
state: string | null;
country: string | null;
gender: string | null;
last_active_at: string | null;
latitude: number | null;
longitude: number | null;
};

type ProfileWithDistance = ProfileRow & {
distanceMiles?: number | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

return createClient(url, key);
}

const GENDER_OPTIONS = [
"Any",
"Male",
"Female",
"Non-binary",
"Transgender",
"Other",
"Prefer not to say",
];

const RECENCY_OPTIONS = [
{ label: "Any time", value: "any" },
{ label: "Active in 7 days", value: "7" },
{ label: "Active in 30 days", value: "30" },
{ label: "Active in 90 days", value: "90" },
];

const RADIUS_OPTIONS = [
{ label: "Anywhere", value: "any" },
{ label: "Within 10 miles", value: "10" },
{ label: "Within 25 miles", value: "25" },
{ label: "Within 50 miles", value: "50" },
{ label: "Within 100 miles", value: "100" },
{ label: "Within 250 miles", value: "250" },
];

function timeAgo(ts: string | null) {
if (!ts) return "";
const then = new Date(ts).getTime();
const now = Date.now();
const s = Math.max(0, Math.floor((now - then) / 1000));
if (s < 60) return "active just now";
if (s < 3600) return `active ${Math.floor(s / 60)}m ago`;
if (s < 86400) return `active ${Math.floor(s / 3600)}h ago`;
return `active ${Math.floor(s / 86400)}d ago`;
}

function isActiveNow(ts: string | null) {
if (!ts) return false;
const then = new Date(ts).getTime();
const now = Date.now();
return now - then <= 5 * 60 * 1000;
}

function toRad(n: number) {
return (n * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
const earthRadiusMiles = 3959;
const dLat = toRad(lat2 - lat1);
const dLon = toRad(lon2 - lon1);

const a =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos(toRad(lat1)) *
Math.cos(toRad(lat2)) *
Math.sin(dLon / 2) *
Math.sin(dLon / 2);

const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
return earthRadiusMiles * c;
}

function formatDistance(miles?: number | null) {
if (miles == null || Number.isNaN(miles)) return "";
if (miles < 1) return "less than 1 mile away";
if (miles < 10) return `${miles.toFixed(1)} miles away`;
return `${Math.round(miles)} miles away`;
}

export default function SearchBox({ initialValue = "" }: { initialValue?: string }) {
const supabase = useMemo(() => getSupabase(), []);

const [q, setQ] = useState(initialValue);
const [locationText, setLocationText] = useState("");
const [gender, setGender] = useState("Any");
const [recency, setRecency] = useState("any");
const [radius, setRadius] = useState("any");

const [submittedQ, setSubmittedQ] = useState(initialValue);
const [submittedLocationText, setSubmittedLocationText] = useState("");
const [submittedGender, setSubmittedGender] = useState("Any");
const [submittedRecency, setSubmittedRecency] = useState("any");
const [submittedRadius, setSubmittedRadius] = useState("any");

const [loading, setLoading] = useState(false);
const [results, setResults] = useState<ProfileWithDistance[]>([]);
const [error, setError] = useState<string | null>(null);

const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
const [geoError, setGeoError] = useState<string | null>(null);

const [showRadar, setShowRadar] = useState(false);

useEffect(() => {
setQ(initialValue);
setSubmittedQ(initialValue);
}, [initialValue]);

useEffect(() => {
if (typeof window === "undefined" || !navigator.geolocation) {
setGeoError("Geolocation not available on this device.");
return;
}

navigator.geolocation.getCurrentPosition(
(pos) => {
setMyCoords({
lat: pos.coords.latitude,
lng: pos.coords.longitude,
});
setGeoError(null);
},
() => {
setGeoError("Location permission denied or unavailable.");
},
{
enableHighAccuracy: true,
timeout: 10000,
maximumAge: 300000,
}
);
}, []);

function runSearch() {
const nextQ = q.trim();
const nextLocation = locationText.trim();
const usingRadius = radius !== "any";

if (usingRadius) {
setShowRadar(true);

window.setTimeout(() => {
setShowRadar(false);
setSubmittedQ(nextQ);
setSubmittedLocationText(nextLocation);
setSubmittedGender(gender);
setSubmittedRecency(recency);
setSubmittedRadius(radius);
}, 2200);

return;
}

setSubmittedQ(nextQ);
setSubmittedLocationText(nextLocation);
setSubmittedGender(gender);
setSubmittedRecency(recency);
setSubmittedRadius(radius);
}

function clearFilters() {
setQ("");
setLocationText("");
setGender("Any");
setRecency("any");
setRadius("any");

setSubmittedQ("");
setSubmittedLocationText("");
setSubmittedGender("Any");
setSubmittedRecency("any");
setSubmittedRadius("any");

setResults([]);
setError(null);
setLoading(false);
setShowRadar(false);
}

useEffect(() => {
let cancelled = false;

async function run() {
const term = submittedQ.trim();
const loc = submittedLocationText.trim();

setError(null);

if (
!term &&
!loc &&
submittedGender === "Any" &&
submittedRecency === "any" &&
submittedRadius === "any"
) {
setResults([]);
setLoading(false);
return;
}

if (submittedRadius !== "any" && !myCoords) {
setError("Turn on location access to use radius search.");
setResults([]);
setLoading(false);
return;
}

setLoading(true);

let query = supabase
.from("profiles")
.select(
"id, username, display_name, bio, avatar_url, city, state, country, gender, last_active_at, latitude, longitude"
)
.limit(100);

if (term) {
query = query.or(
`username.ilike.%${term}%,display_name.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%,country.ilike.%${term}%`
);
}

if (loc) {
query = query.or(
`city.ilike.%${loc}%,state.ilike.%${loc}%,country.ilike.%${loc}%`
);
}

if (submittedGender !== "Any") {
query = query.eq("gender", submittedGender);
}

if (submittedRecency !== "any") {
const days = Number(submittedRecency);
const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
query = query.gte("last_active_at", cutoff);
}

query = query.order("last_active_at", { ascending: false, nullsFirst: false });

const { data, error } = await query;

if (cancelled) return;

if (error) {
setError(error.message);
setResults([]);
setLoading(false);
return;
}

let rows = ((data as ProfileRow[]) ?? []).map((p) => ({
...p,
distanceMiles: null,
})) as ProfileWithDistance[];

if (submittedRadius !== "any" && myCoords) {
const maxMiles = Number(submittedRadius);

rows = rows
.filter((p) => p.latitude != null && p.longitude != null)
.map((p) => {
const distanceMiles = haversineMiles(
myCoords.lat,
myCoords.lng,
Number(p.latitude),
Number(p.longitude)
);

return {
...p,
distanceMiles,
};
})
.filter((p) => (p.distanceMiles ?? Infinity) <= maxMiles)
.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
}

setResults(rows);
setLoading(false);
}

void run();

return () => {
cancelled = true;
};
}, [
submittedQ,
submittedLocationText,
submittedGender,
submittedRecency,
submittedRadius,
supabase,
myCoords,
]);

const shell: React.CSSProperties = {
width: "min(920px, 94vw)",
margin: "18px auto 0",
padding: "16px",
borderRadius: 16,
background: "rgba(0,0,0,0.45)",
border: "1px solid rgba(255,255,255,0.14)",
boxShadow: "0 0 22px rgba(170, 90, 255, 0.20)",
};

const inputStyle: React.CSSProperties = {
width: "100%",
padding: "12px 14px",
borderRadius: 12,
outline: "none",
border: "1px solid rgba(255,255,255,0.20)",
background: "rgba(0,0,0,0.35)",
color: "white",
fontSize: 16,
};

const filterRow: React.CSSProperties = {
display: "flex",
flexWrap: "wrap",
gap: 12,
marginTop: 12,
alignItems: "center",
};

const smallInput: React.CSSProperties = {
minWidth: 220,
flex: "1 1 220px",
padding: "10px 12px",
borderRadius: 12,
outline: "none",
border: "1px solid rgba(255,255,255,0.18)",
background: "rgba(0,0,0,0.30)",
color: "white",
fontSize: 15,
};

const selectStyle: React.CSSProperties = {
minWidth: 220,
padding: "10px 12px",
borderRadius: 12,
outline: "none",
border: "1px solid rgba(255,255,255,0.18)",
background: "rgba(0,0,0,0.30)",
color: "white",
fontSize: 15,
appearance: "none",
};

const searchBtn: React.CSSProperties = {
padding: "10px 14px",
borderRadius: 12,
border: "1px solid rgba(170, 90, 255, 0.45)",
background: "rgba(120, 60, 220, 0.18)",
color: "rgba(235,220,255,0.95)",
cursor: "pointer",
fontWeight: 800,
boxShadow: "0 0 18px rgba(170, 90, 255, 0.18)",
};

const clearBtn: React.CSSProperties = {
padding: "10px 12px",
borderRadius: 12,
border: "1px solid rgba(170, 90, 255, 0.35)",
background: "rgba(120, 60, 220, 0.12)",
color: "rgba(235,220,255,0.95)",
cursor: "pointer",
fontWeight: 700,
};

const row: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 14,
padding: "14px 12px",
marginTop: 10,
borderRadius: 14,
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(0,0,0,0.30)",
};

const avatar: React.CSSProperties = {
width: 44,
height: 44,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.18)",
flex: "0 0 auto",
};

const nameStyle: React.CSSProperties = {
fontSize: 18,
fontWeight: 800,
};

const subStyle: React.CSSProperties = {
opacity: 0.85,
marginTop: 4,
};

const viewLink: React.CSSProperties = {
marginLeft: "auto",
padding: "10px 12px",
borderRadius: 12,
border: "1px solid rgba(170, 90, 255, 0.45)",
color: "rgba(220, 190, 255, 0.95)",
textDecoration: "none",
background: "rgba(120, 60, 220, 0.18)",
boxShadow: "0 0 18px rgba(170, 90, 255, 0.18)",
whiteSpace: "nowrap",
};

const hasActiveSearch =
!!submittedQ ||
!!submittedLocationText ||
submittedGender !== "Any" ||
submittedRecency !== "any" ||
submittedRadius !== "any";

return (
<div style={shell}>
<style>{`
@keyframes unboundRadarSpin {
from { transform: rotate(0deg); }
to { transform: rotate(360deg); }
}

@keyframes unboundRadarPulse {
0%, 100% { opacity: 0.55; transform: scale(1); }
50% { opacity: 1; transform: scale(1.08); }
}
`}</style>

<input
style={inputStyle}
value={q}
onChange={(e) => setQ(e.target.value)}
onKeyDown={(e) => {
if (e.key === "Enter") runSearch();
}}
placeholder="Search users..."
/>

<div style={filterRow}>
<input
style={smallInput}
value={locationText}
onChange={(e) => setLocationText(e.target.value)}
onKeyDown={(e) => {
if (e.key === "Enter") runSearch();
}}
placeholder="City / state / country"
/>

<select
value={gender}
onChange={(e) => setGender(e.target.value)}
style={selectStyle}
>
{GENDER_OPTIONS.map((option) => (
<option key={option} value={option} style={{ color: "black" }}>
{option}
</option>
))}
</select>

<select
value={recency}
onChange={(e) => setRecency(e.target.value)}
style={selectStyle}
>
{RECENCY_OPTIONS.map((option) => (
<option key={option.value} value={option.value} style={{ color: "black" }}>
{option.label}
</option>
))}
</select>

<select
value={radius}
onChange={(e) => setRadius(e.target.value)}
style={selectStyle}
>
{RADIUS_OPTIONS.map((option) => (
<option key={option.value} value={option.value} style={{ color: "black" }}>
{option.label}
</option>
))}
</select>

<button onClick={runSearch} style={searchBtn}>
Search
</button>

<button onClick={clearFilters} style={clearBtn}>
Clear filters
</button>
</div>

{submittedRadius !== "any" && geoError ? (
<div style={{ marginTop: 10, color: "#ffb3b3" }}>{geoError}</div>
) : null}

<div style={{ marginTop: 10, opacity: 0.85 }}>
{loading || showRadar
? "Searching..."
: error
? `Error: ${error}`
: results.length
? ""
: hasActiveSearch
? "No matches."
: ""}
</div>

{showRadar ? (
<div
style={{
position: "relative",
width: 280,
height: 280,
margin: "40px auto 10px",
borderRadius: "50%",
}}
>
<div
style={{
position: "absolute",
top: "50%",
left: "50%",
transform: "translate(-50%, -50%)",
width: 280,
height: 280,
borderRadius: "50%",
border: "1px solid rgba(180,120,255,0.18)",
}}
/>
<div
style={{
position: "absolute",
top: "50%",
left: "50%",
transform: "translate(-50%, -50%)",
width: 210,
height: 210,
borderRadius: "50%",
border: "1px solid rgba(180,120,255,0.18)",
}}
/>
<div
style={{
position: "absolute",
top: "50%",
left: "50%",
transform: "translate(-50%, -50%)",
width: 140,
height: 140,
borderRadius: "50%",
border: "1px solid rgba(180,120,255,0.18)",
}}
/>

<div
style={{
position: "absolute",
top: "50%",
left: "50%",
width: 140,
height: 140,
transformOrigin: "0% 0%",
background:
"conic-gradient(from 0deg, rgba(220,110,255,0.58), rgba(220,110,255,0.06) 70deg, rgba(220,110,255,0) 90deg)",
clipPath: "polygon(0 0, 100% 0, 100% 100%)",
animation: "unboundRadarSpin 1.4s linear infinite",
filter: "drop-shadow(0 0 12px rgba(220,110,255,0.55))",
}}
/>

<div
style={{
position: "absolute",
top: "50%",
left: "50%",
width: 16,
height: 16,
borderRadius: "50%",
background: "#d98cff",
transform: "translate(-50%, -50%)",
boxShadow: "0 0 14px rgba(217,140,255,0.95)",
animation: "unboundRadarPulse 1.2s ease-in-out infinite",
}}
/>

<div
style={{
position: "absolute",
top: "62%",
left: "65%",
width: 10,
height: 10,
borderRadius: "50%",
background: "#d98cff",
boxShadow: "0 0 10px rgba(217,140,255,0.95)",
}}
/>

<div
style={{
position: "absolute",
bottom: -36,
width: "100%",
textAlign: "center",
opacity: 0.85,
fontWeight: 700,
color: "rgba(235,220,255,0.95)",
}}
>
Scanning nearby…
</div>
</div>
) : null}

{!showRadar &&
results.map((p) => {
const label = p.display_name || p.username || "Unknown";
const handle = p.username ? `@${p.username}` : null;
const locationLine = [p.city, p.state, p.country].filter(Boolean).join(", ");
const distanceLine = formatDistance(p.distanceMiles);

return (
<div key={p.id} style={row}>
{p.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={p.avatar_url} alt="" style={avatar} />
) : (
<div style={{ ...avatar, display: "grid", placeItems: "center", opacity: 0.7 }}>
?
</div>
)}

<div style={{ minWidth: 0 }}>
<div
style={{
...nameStyle,
display: "flex",
alignItems: "center",
gap: 8,
}}
>
<span>{label}</span>

{isActiveNow(p.last_active_at) ? (
<span
title="Active now"
style={{
width: 10,
height: 10,
borderRadius: 999,
background: "#22c55e",
boxShadow: "0 0 10px rgba(34,197,94,0.75)",
display: "inline-block",
}}
/>
) : null}
</div>

{handle ? <div style={subStyle}>{handle}</div> : null}
{locationLine ? <div style={subStyle}>{locationLine}</div> : null}
{distanceLine ? <div style={subStyle}>{distanceLine}</div> : null}
{p.gender ? <div style={subStyle}>{p.gender}</div> : null}
{p.last_active_at ? <div style={subStyle}>{timeAgo(p.last_active_at)}</div> : null}
{p.bio ? <div style={{ opacity: 0.9, marginTop: 8 }}>{p.bio}</div> : null}
</div>

<Link href={`/u/${p.id}`} style={viewLink}>
View →
</Link>
</div>
);
})}
</div>
);
}