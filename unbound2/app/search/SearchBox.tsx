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
location?: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

return createClient(url, key);
}

export default function SearchBox({ initialValue = "" }: { initialValue?: string }) {
const supabase = useMemo(() => getSupabase(), []);
const [q, setQ] = useState(initialValue);
const [loading, setLoading] = useState(false);
const [results, setResults] = useState<ProfileRow[]>([]);
const [error, setError] = useState<string | null>(null);

// keep input in sync if /search?q=... changes server-side
useEffect(() => {
setQ(initialValue);
}, [initialValue]);

useEffect(() => {
let cancelled = false;

async function run() {
const term = (q || "").trim();
setError(null);

if (!term) {
setResults([]);
return;
}

setLoading(true);

// ✅ IMPORTANT: search BOTH username and display_name
const { data, error } = await supabase
.from("profiles")
.select("id, username, display_name, bio, avatar_url")
.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
.limit(25);

if (cancelled) return;

if (error) {
setError(error.message);
setResults([]);
} else {
setResults((data as ProfileRow[]) ?? []);
}

setLoading(false);
}

const t = setTimeout(run, 250); // small debounce so it doesn’t spam queries
return () => {
cancelled = true;
clearTimeout(t);
};
}, [q, supabase]);

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

const nameStyle: React.CSSProperties = { fontSize: 18, fontWeight: 800 };
const subStyle: React.CSSProperties = { opacity: 0.85, marginTop: 4 };

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

return (
<div style={shell}>
<input
style={inputStyle}
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="Type a username or display name. Results update automatically."
/>

<div style={{ marginTop: 10, opacity: 0.85 }}>
{loading ? "Searching..." : error ? `Error: ${error}` : results.length ? "" : q.trim() ? "No matches." : ""}
</div>

{results.map((p) => {
const label = p.display_name || p.username || "Unknown";
const handle = p.username ? `@${p.username}` : null;

return (
<div key={p.id} style={row}>
{p.avatar_url ? (
// If your avatar_url is already a full URL, this is fine.
// If it’s a Supabase storage path, we can adjust later.
<img src={p.avatar_url} alt="" style={avatar} />
) : (
<div style={{ ...avatar, display: "grid", placeItems: "center", opacity: 0.7 }}>?</div>
)}

<div style={{ minWidth: 0 }}>
<div style={nameStyle}>{label}</div>
{handle ? <div style={subStyle}>{handle}</div> : null}
{p.bio ? <div style={{ opacity: 0.9, marginTop: 8 }}>{p.bio}</div> : null}
</div>

{/* ✅ THIS is the part that was broken before.
Link must wrap its content properly. */}
<Link href={`/u/${p.id}`} style={viewLink}>
View →
</Link>
</div>
);
})}
</div>
);
}