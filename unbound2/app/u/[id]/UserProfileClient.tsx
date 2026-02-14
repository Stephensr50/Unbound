"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
bio: string | null;
avatar_url: string | null;
};

type PostRow = {
id: number;
user_id: string;
body: string | null;
kind: string;
created_at: string;

// media support
media_url: string | null;
media_type: string | null;
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

export default function UserProfileClient({ profile }: { profile: ProfileRow }) {
const supabase = useMemo(() => getSupabase(), []);

const [posts, setPosts] = useState<PostRow[]>([]);
const [banner, setBanner] = useState<string | null>(null);

useEffect(() => {
let cancelled = false;

(async () => {
if (!profile?.id) return;

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type")
.eq("user_id", profile.id)
.order("created_at", { ascending: false })
.limit(50);

if (cancelled) return;

if (error) {
setBanner(error.message);
setPosts([]);
return;
}

setBanner(null);
setPosts((data ?? []) as PostRow[]);
})();

return () => {
cancelled = true;
};
}, [profile?.id, supabase]);

const card: CSSProperties = {
width: "min(920px, 94vw)",
margin: "22px auto 0",
padding: 18,
borderRadius: 18,
background: "rgba(0,0,0,0.45)",
border: "1px solid rgba(180,120,255,0.20)",
boxShadow: "0 0 22px rgba(170,90,255,0.18)",
color: "white",
};

const postCard: CSSProperties = {
background: "rgba(0,0,0,0.35)",
border: "1px solid rgba(180,120,255,0.14)",
borderRadius: 14,
padding: 14,
};

return (
<div style={{ paddingBottom: 40 }}>
{/* Profile Header */}
<div style={card}>
<div style={{ display: "flex", gap: 16, alignItems: "center" }}>
<div
style={{
width: 92,
height: 92,
borderRadius: 999,
overflow: "hidden",
border: "1px solid rgba(180,120,255,0.35)",
background: "rgba(0,0,0,0.4)",
flex: "0 0 auto",
}}
>
{profile.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={profile.avatar_url}
alt=""
style={{ width: "100%", height: "100%", objectFit: "cover" }}
/>
) : null}
</div>

<div>
<div style={{ fontSize: 28, fontWeight: 800 }}>
{profile.display_name || profile.username || "User"}
</div>
{profile.username ? (
<div style={{ opacity: 0.7 }}>@{profile.username}</div>
) : null}
</div>
</div>

{profile.bio ? (
<div style={{ marginTop: 14, opacity: 0.9 }}>{profile.bio}</div>
) : null}
</div>

{/* Posts */}
<div style={{ ...card, marginTop: 18 }}>
<div style={{ fontWeight: 800, marginBottom: 12 }}>Posts</div>

{banner ? (
<div style={{ opacity: 0.85, fontSize: 13, marginBottom: 10 }}>
{banner}
</div>
) : null}

<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
{posts.map((p) => (
<div key={p.id} style={postCard}>
<div style={{ opacity: 0.6, fontSize: 12, marginBottom: 8 }}>
{timeAgo(p.created_at)}
</div>

{/* MEDIA (image/video) */}
{p.media_url ? (
p.media_type?.startsWith("video") ? (
<video
src={p.media_url}
controls
playsInline
style={{
width: "100%",
borderRadius: 14,
marginBottom: 10,
background: "rgba(0,0,0,0.35)",
}}
/>
) : (
// eslint-disable-next-line @next/next/no-img-element
<img
src={p.media_url}
alt=""
style={{
width: "100%",
borderRadius: 14,
marginBottom: 10,
display: "block",
}}
/>
)
) : null}

{/* BODY */}
{p.body ? (
<div style={{ whiteSpace: "pre-wrap" }}>{p.body}</div>
) : null}
</div>
))}

{posts.length === 0 ? (
<div style={{ opacity: 0.6, fontSize: 13 }}>No posts yet.</div>
) : null}
</div>
</div>
</div>
);
}