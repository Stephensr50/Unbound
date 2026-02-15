"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import PublicProfileActions from "./PublicProfileActions";
import PostActions from "../../components/PostActions";

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
media_url: string | null;
media_type: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
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
const [loading, setLoading] = useState(true);
const [err, setErr] = useState<string | null>(null);

useEffect(() => {
let cancelled = false;

(async () => {
try {
setLoading(true);
setErr(null);

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type")
.eq("user_id", profile.id)
.order("created_at", { ascending: false })
.limit(50);

if (error) throw error;
if (!cancelled) setPosts((data ?? []) as PostRow[]);
} catch (e: any) {
if (!cancelled) setErr(String(e?.message || e));
} finally {
if (!cancelled) setLoading(false);
}
})();

return () => {
cancelled = true;
};
}, [supabase, profile.id]);

const wrap: React.CSSProperties = {
width: "min(920px, 94vw)",
margin: "22px auto 40px",
color: "white",
};

const panel: React.CSSProperties = {
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(180,120,255,0.18)",
borderRadius: 18,
padding: 18,
boxShadow: "0 0 24px rgba(0,0,0,0.35)",
};

const headerRow: React.CSSProperties = {
display: "flex",
gap: 18,
alignItems: "center",
};

const avatar: React.CSSProperties = {
width: 86,
height: 86,
borderRadius: 12,
objectFit: "cover",
border: "1px solid rgba(180,120,255,0.22)",
boxShadow: "0 0 18px rgba(192,38,211,0.18)",
background: "rgba(0,0,0,0.4)",
flex: "0 0 auto",
};

const nameStyle: React.CSSProperties = {
fontSize: 40,
fontWeight: 900,
letterSpacing: 0.2,
lineHeight: 1.05,
textShadow: "0 0 22px rgba(192,38,211,0.20)",
};

const bioStyle: React.CSSProperties = {
marginTop: 10,
opacity: 0.9,
fontSize: 15,
lineHeight: 1.45,
maxWidth: 740,
};

const divider: React.CSSProperties = {
height: 1,
background: "linear-gradient(90deg, rgba(180,120,255,0.0), rgba(180,120,255,0.28), rgba(180,120,255,0.0))",
margin: "16px 0 14px",
};

const postsPanel: React.CSSProperties = {
...panel,
marginTop: 14,
};

const postCard: React.CSSProperties = {
background: "rgba(0,0,0,0.35)",
border: "1px solid rgba(180,120,255,0.14)",
borderRadius: 16,
padding: 14,
};

const renderMedia = (p: PostRow) => {
if (!p.media_url) return null;

const isVideo =
(p.media_type && p.media_type.startsWith("video/")) || p.kind === "video";
const isImage =
(p.media_type && p.media_type.startsWith("image/")) || p.kind === "image";

if (isVideo) {
return (
<video
src={p.media_url}
controls
style={{
width: "100%",
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.14)",
marginBottom: 10,
maxHeight: 520,
background: "rgba(0,0,0,0.5)",
}}
/>
);
}

if (isImage) {
// eslint-disable-next-line @next/next/no-img-element
return (
<img
src={p.media_url}
alt=""
style={{
width: "100%",
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.14)",
marginBottom: 10,
objectFit: "cover",
maxHeight: 620,
}}
/>
);
}

return null;
};

return (
<div style={wrap}>
{/* Top profile panel */}
<div style={panel}>
<div style={headerRow}>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
src={profile.avatar_url || "/default-avatar.png"}
alt=""
style={avatar}
/>

<div style={{ flex: 1, minWidth: 0 }}>
<div style={nameStyle}>
{profile.display_name || profile.username || "Profile"}
</div>

{profile.username ? (
<div style={{ marginTop: 6, opacity: 0.65, fontSize: 13 }}>
@{profile.username}
</div>
) : null}

{profile.bio ? <div style={bioStyle}>{profile.bio}</div> : null}

{/* ✅ ACTIONS BAR — ALWAYS UNDER BIO */}
<div style={{ marginTop: 14 }}>
<PublicProfileActions targetProfileId={profile.id} />
</div>
</div>
</div>
</div>

{/* Posts */}
<div style={postsPanel}>
<div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>
Posts
</div>

{err ? (
<div
style={{
padding: 12,
borderRadius: 14,
background: "rgba(120,0,0,0.28)",
border: "1px solid rgba(255,80,80,0.35)",
color: "rgba(255,220,220,0.95)",
fontSize: 13,
}}
>
{err}
</div>
) : null}

{loading ? (
<div style={{ opacity: 0.7, padding: 10 }}>Loading…</div>
) : posts.length === 0 ? (
<div style={{ opacity: 0.7, padding: 10 }}>No posts yet.</div>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
{posts.map((p) => (
<div key={p.id} style={postCard}>
<div style={{ opacity: 0.65, fontSize: 12, marginBottom: 8 }}>
{timeAgo(p.created_at)}
</div>

{renderMedia(p)}

{p.body ? (
<div style={{ fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{p.body}
</div>
) : null}

<PostActions postId={p.id} />
</div>
))}
</div>
)}

<div style={divider} />
</div>
</div>
);
}