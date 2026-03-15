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

export default function SearchBox({ initialValue = "" }: { initialValue?: string }) {
const supabase = useMemo(() => getSupabase(), []);

const [q, setQ] = useState(initialValue);
const [locationText, setLocationText] = useState("");
const [gender, setGender] = useState("Any");
const [recency, setRecency] = useState("any");

const [submittedQ, setSubmittedQ] = useState(initialValue);
const [submittedLocationText, setSubmittedLocationText] = useState("");
const [submittedGender, setSubmittedGender] = useState("Any");
const [submittedRecency, setSubmittedRecency] = useState("any");

const [loading, setLoading] = useState(false);
const [results, setResults] = useState<ProfileRow[]>([]);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
setQ(initialValue);
setSubmittedQ(initialValue);
}, [initialValue]);

function runSearch() {
setSubmittedQ(q.trim());
setSubmittedLocationText(locationText.trim());
setSubmittedGender(gender);
setSubmittedRecency(recency);
}

function clearFilters() {
setQ("");
setLocationText("");
setGender("Any");
setRecency("any");
setSubmittedQ("");
setSubmittedLocationText("");
setSubmittedGender("Any");
setSubmittedRecency("any");
setResults([]);
setError(null);
setLoading(false);
}

useEffect(() => {
let cancelled = false;

async function run() {
const term = submittedQ.trim();
const loc = submittedLocationText.trim();

setError(null);

if (!term && !loc && submittedGender === "Any" && submittedRecency === "any") {
setResults([]);
setLoading(false);
return;
}

setLoading(true);

let query = supabase
.from("profiles")
.select(
"id, username, display_name, bio, avatar_url, city, state, country, gender, last_active_at"
)
.limit(25);

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
} else {
setResults((data as ProfileRow[]) ?? []);
}

setLoading(false);
}

void run();

return () => {
cancelled = true;
};
}, [submittedQ, submittedLocationText, submittedGender, submittedRecency, supabase]);

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
submittedRecency !== "any";

return (
<div style={shell}>
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

<button onClick={runSearch} style={searchBtn}>
Search
</button>

<button onClick={clearFilters} style={clearBtn}>
Clear filters
</button>
</div>

<div style={{ marginTop: 10, opacity: 0.85 }}>
{loading
? "Searching..."
: error
? `Error: ${error}`
: results.length
? ""
: hasActiveSearch
? "No matches."
: ""}
</div>

{results.map((p) => {
const label = p.display_name || p.username || "Unknown";
const handle = p.username ? `@${p.username}` : null;
const locationLine = [p.city, p.state, p.country].filter(Boolean).join(", ");

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