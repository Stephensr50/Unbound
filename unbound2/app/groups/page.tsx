"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error(
"Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
);
}

return createClient(url, key);
}

type GroupRow = {
id: number;
creator_id: string;
name: string;
slug: string;
description: string | null;
avatar_url: string | null;
banner_url: string | null;
visibility: "public" | "private";
created_at: string;
};

export default function GroupsPage() {
const supabase = useMemo(() => getSupabase(), []);

const [groups, setGroups] = useState<GroupRow[]>([]);
const [loading, setLoading] = useState(true);
const [status, setStatus] = useState("");

useEffect(() => {
let alive = true;

async function loadGroups() {
try {
setLoading(true);
setStatus("");

const { data, error } = await supabase
.from("groups")
.select("*")
.order("created_at", { ascending: false });

if (error) throw error;
if (!alive) return;

setGroups((data ?? []) as GroupRow[]);
setLoading(false);
} catch (e: any) {
if (!alive) return;
setStatus(e?.message || "Failed to load groups.");
setLoading(false);
}
}

void loadGroups();

return () => {
alive = false;
};
}, [supabase]);

const shell: React.CSSProperties = {
width: "min(980px, 94vw)",
margin: "24px auto",
};

const headerRow: React.CSSProperties = {
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 12,
marginBottom: 16,
flexWrap: "wrap",
};

const createBtn: React.CSSProperties = {
padding: "10px 14px",
borderRadius: 12,
border: "1px solid rgba(170, 90, 255, 0.45)",
background: "rgba(120, 60, 220, 0.18)",
color: "rgba(235,220,255,0.95)",
fontWeight: 800,
textDecoration: "none",
boxShadow: "0 0 18px rgba(170, 90, 255, 0.18)",
};

const card: React.CSSProperties = {
display: "block",
padding: 16,
borderRadius: 16,
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(180,120,255,0.18)",
boxShadow: "0 0 18px rgba(168,85,247,0.12)",
textDecoration: "none",
color: "white",
marginBottom: 14,
};

if (loading) {
return (
<div style={shell}>
<div style={{ opacity: 0.85 }}>Loading groups...</div>
</div>
);
}

return (
<div style={shell}>
<div style={headerRow}>
<div>
<h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>Groups</h1>
<div style={{ opacity: 0.78, marginTop: 6 }}>
Discover and create communities on Unbound.
</div>
</div>

<Link href="/groups/new" style={createBtn}>
Create group
</Link>
</div>

{status ? (
<div style={{ marginBottom: 12, opacity: 0.9 }}>{status}</div>
) : null}

{groups.length === 0 ? (
<div
style={{
padding: 18,
borderRadius: 16,
background: "rgba(0,0,0,0.42)",
border: "1px solid rgba(255,255,255,0.08)",
opacity: 0.88,
}}
>
No groups yet. Be the first to create one.
</div>
) : null}

{groups.map((group) => (
<Link key={group.id} href={`/groups/${group.slug}`} style={card}>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "flex-start",
flexWrap: "wrap",
}}
>
<div>
<div style={{ fontSize: 22, fontWeight: 900 }}>{group.name}</div>
<div style={{ opacity: 0.68, marginTop: 4 }}>
{group.visibility === "private" ? "Private group" : "Public group"}
</div>

{group.description ? (
<div style={{ marginTop: 10, lineHeight: 1.5, opacity: 0.92 }}>
{group.description}
</div>
) : null}
</div>

<div
style={{
opacity: 0.72,
fontSize: 13,
whiteSpace: "nowrap",
}}
>
Open →
</div>
</div>
</Link>
))}
</div>
);
}