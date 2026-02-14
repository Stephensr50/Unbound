"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type PostRow = {
id: number;
user_id: string;
body: string | null;
kind: string | null; // "text" | "photo" | "video"
created_at: string;
// IMPORTANT: your DB might call this media_url OR image_url OR file_url.
// We'll try media_url first, but you can rename it if needed.
media_url?: string | null;
image_url?: string | null;
file_url?: string | null;
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

export default function ProfileFeedClient() {
const supabase = useMemo(() => getSupabase(), []);

const [myUserId, setMyUserId] = useState<string | null>(null);
const [posts, setPosts] = useState<PostRow[]>([]);
const [banner, setBanner] = useState<string | null>(null);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadMyPosts(uid: string) {
setBanner(null);

// ✅ Select ALL fields needed for media rendering.
// If your column is not media_url, change this select string.
const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type")
.eq("user_id", uid)
.order("created_at", { ascending: false })
.limit(50);

if (error) {
setBanner(error.message);
setPosts([]);
return;
}

setPosts((data ?? []) as PostRow[]);
}

useEffect(() => {
(async () => {
const uid = await refreshAuth();
if (!uid) {
setBanner("Not signed in.");
setPosts([]);
return;
}
await loadMyPosts(uid);
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const card: React.CSSProperties = {
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(180,120,255,0.16)",
borderRadius: 16,
padding: 14,
};

const mediaStyle: React.CSSProperties = {
width: "100%",
borderRadius: 14,
marginTop: 12,
border: "1px solid rgba(180,120,255,0.16)",
display: "block",
maxHeight: 560,
objectFit: "cover",
};

return (
<div style={{ width: "min(920px, 94vw)", margin: "16px auto 0" }}>
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

<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
{posts.map((p) => {
const media =
p.media_url ?? p.image_url ?? p.file_url ?? null;

const isVideo =
(p.kind ?? "").toLowerCase().includes("video") ||
(!!media && /\.(mp4|webm|mov)(\?|$)/i.test(media));

const isPhoto =
(p.kind ?? "").toLowerCase().includes("photo") ||
(p.kind ?? "").toLowerCase().includes("image") ||
(!!media && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(media));

return (
<div key={p.id} style={card}>
<div
style={{
display: "flex",
justifyContent: "space-between",
marginBottom: 8,
}}
>
<div style={{ opacity: 0.65, fontSize: 12 }}>
{timeAgo(p.created_at)}
</div>
<div style={{ opacity: 0.55, fontSize: 12 }}>
@{/* you can wire username later */}robby_78
</div>
</div>

{p.body ? (
<div style={{ fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{p.body}
</div>
) : null}

{/* ✅ Media render */}
{media && (isPhoto || isVideo) ? (
isVideo ? (
<video
src={media}
controls
style={mediaStyle}
/>
) : (
// eslint-disable-next-line @next/next/no-img-element
<img
src={media}
alt=""
style={mediaStyle}
/>
)
) : null}
</div>
);
})}

{posts.length === 0 ? (
<div style={{ opacity: 0.65, fontSize: 13, padding: 8 }}>
No posts yet.
</div>
) : null}
</div>
</div>
);
}