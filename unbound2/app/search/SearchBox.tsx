"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Profile = {
id: string;
display_name: string | null;
bio: string | null;
avatar_url?: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env.");
}

return createClient(url, key);
}

export default function SearchBox({ initialValue = "" }: { initialValue?: string }) {
const supabase = useMemo(() => getSupabase(), []);
const [q, setQ] = useState(initialValue);
const [loading, setLoading] = useState(false);
const [results, setResults] = useState<Profile[]>([]);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
setQ(initialValue);
}, [initialValue]);

useEffect(() => {
let cancelled = false;

async function run() {
const term = q.trim();
setError(null);

if (!term) {
setResults([]);
return;
}

setLoading(true);

const { data, error } = await supabase
.from("profiles")
.select("id, display_name, bio, avatar_url")
.ilike("display_name", `%${term}%`)
.limit(25);

if (cancelled) return;

if (error) {
setError(error.message);
setResults([]);
} else {
setResults((data as Profile[]) ?? []);
}

setLoading(false);
}

run();

return () => {
cancelled = true;
};
}, [q, supabase]);

return (
<div style={{ width: "100%" }}>
<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="Search people…"
style={{
flex: 1,
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.35)",
color: "white",
outline: "none",
}}
/>
</div>

<div style={{ marginTop: 14 }}>
{loading && <div style={{ opacity: 0.8 }}>Searching…</div>}
{error && <div style={{ color: "#ff6b6b" }}>{error}</div>}

{!loading && !error && q.trim() && results.length === 0 && (
<div style={{ opacity: 0.8 }}>No matches.</div>
)}

{results.length > 0 && (
<div style={{ display: "grid", gap: 10 }}>
{results.map((p) => (
<Link
key={p.id}
href={`/u/${p.id}`}
style={{
textDecoration: "none",
color: "white",
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(0,0,0,0.30)",
borderRadius: 14,
padding: 12,
display: "flex",
justifyContent: "space-between",
alignItems: "center",
}}
>
<div>
<div style={{ fontWeight: 700 }}>
{p.display_name ?? "(no display name)"}
</div>
{p.bio ? (
<div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
{p.bio}
</div>
) : null}
</div>
<div style={{ opacity: 0.7 }}>View</div>
</Link>
))}
</div>
)}
</div>
</div>
);
}