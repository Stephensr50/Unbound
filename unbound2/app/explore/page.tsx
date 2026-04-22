"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type ExplorePostRow = {
id: number;
user_id: string;
body: string | null;
kind: string;
created_at: string;
media_url: string | null;
media_type: string | null;
};

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

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

export default function ExplorePage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [posts, setPosts] = useState<ExplorePostRow[]>([]);
const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
{}
);
const [loading, setLoading] = useState(true);
const [banner, setBanner] = useState<string | null>(null);

useEffect(() => {
let alive = true;

async function loadExplore() {
try {
setLoading(true);
setBanner(null);

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type")
.not("media_url", "is", null)
.order("created_at", { ascending: false })
.limit(200);

if (error) throw error;
if (!alive) return;

const rawRows = ((data ?? []) as ExplorePostRow[]).filter(
(p) => !!p.media_url
);

const seen = new Set<string>();
const rows: ExplorePostRow[] = [];
for (const post of rawRows) {
const key = `${post.user_id}::${post.media_url}`;
if (seen.has(key)) continue;
seen.add(key);
rows.push(post);
}

setPosts(rows);

const userIds = Array.from(new Set(rows.map((p) => p.user_id).filter(Boolean)));

if (!userIds.length) {
setProfilesById({});
return;
}

const { data: profs, error: profErr } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", userIds);

if (profErr) throw profErr;
if (!alive) return;

const map: Record<string, ProfileRow> = {};
for (const p of (profs ?? []) as ProfileRow[]) {
map[p.id] = p;
}
setProfilesById(map);
} catch (e: any) {
if (!alive) return;
setBanner(e?.message || "Failed to load explore.");
} finally {
if (alive) setLoading(false);
}
}

void loadExplore();

return () => {
alive = false;
};
}, [supabase]);

return (
<div style={{ maxWidth: 1240, margin: "0 auto", padding: 16 }}>
<style>{`
.exploreCard {
border: 1px solid rgba(180,120,255,0.16);
background: rgba(0,0,0,0.46);
border-radius: 20px;
overflow: hidden;
padding: 0;
cursor: pointer;
text-align: left;
transition:
transform 0.18s ease,
box-shadow 0.18s ease,
border-color 0.18s ease,
background 0.18s ease;
backdrop-filter: blur(4px);
}

.exploreCard:hover {
transform: translateY(-6px) scale(1.025);
border-color: rgba(192,38,211,0.65);
box-shadow:
0 22px 50px rgba(0,0,0,0.45),
0 0 18px rgba(168,85,247,0.35),
0 0 40px rgba(168,85,247,0.45),
0 0 70px rgba(168,85,247,0.25);
background: rgba(0,0,0,0.62);
}

.exploreMedia {
transition: transform 0.24s ease, filter 0.24s ease;
}

.exploreCard:hover .exploreMedia {
transform: scale(1.035);
filter: brightness(1.04);
}

.exploreTopFade {
position: absolute;
inset: 0;
background:
linear-gradient(to bottom, rgba(0,0,0,0.00) 44%, rgba(0,0,0,0.12) 62%, rgba(0,0,0,0.48) 100%);
pointer-events: none;
}

.exploreInfoOverlay {
position: absolute;
left: 10px;
right: 10px;
bottom: 10px;
display: flex;
align-items: center;
gap: 10px;
padding: 10px 12px;
border-radius: 16px;
background: rgba(0,0,0,0.42);
border: 1px solid rgba(255,255,255,0.08);
backdrop-filter: blur(10px);
z-index: 3;
}

.explorePill {
position: absolute;
top: 10px;
right: 10px;
padding: 6px 8px;
border-radius: 999px;
background: rgba(0,0,0,0.55);
border: 1px solid rgba(255,255,255,0.12);
color: rgba(255,255,255,0.92);
font-size: 12px;
font-weight: 800;
z-index: 2;
}
`}</style>

<div style={{ marginBottom: 18 }}>
<div
style={{
fontSize: 46,
fontWeight: 900,
lineHeight: 1,
marginBottom: 10,
}}
>
Explore
</div>

<div
style={{
opacity: 0.82,
fontSize: 15,
}}
></div>
</div>

{banner ? (
<div
style={{
marginBottom: 14,
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

{loading ? (
<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
gap: 18,
}}
>
{Array.from({ length: 8 }).map((_, i) => (
<div
key={i}
style={{
aspectRatio: "4 / 5",
borderRadius: 20,
border: "3px solid rgba(236, 72, 154, 0.62)",
background: "rgba(0,0,0,0.42)",
}}
/>
))}
</div>
) : posts.length === 0 ? (
<div
style={{
borderRadius: 18,
border: "1px solid rgba(180,120,255,0.16)",
background: "rgba(0,0,0,0.45)",
padding: 18,
opacity: 0.86,
}}
>
No photo or video posts yet.
</div>
) : (
<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
gap: 18,
}}
>
{posts.map((post) => {
const profile = profilesById[post.user_id];
const label = profile?.display_name || profile?.username || "Unknown";
const handle = profile?.username ? `@${profile.username}` : "";
const isVideo =
(post.media_type && post.media_type.startsWith("video/")) ||
post.kind === "video";

return (
<div
key={post.id}
role="button"
tabIndex={0}
className="exploreCard"
onClick={() => router.push(`/post/${post.id}`)}
onKeyDown={(e) => {
if (e.key === "Enter" || e.key === " ") {
e.preventDefault();
router.push(`/post/${post.id}`);
}
}}
title={`Open ${label}'s post`}
>
<div
style={{
position: "relative",
aspectRatio: "4 / 5",
background: "rgba(0,0,0,0.45)",
}}
>
{post.media_url ? (
isVideo ? (
<video
src={post.media_url}
muted
playsInline
preload="metadata"
className="exploreMedia"
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
}}
/>
) : (
// eslint-disable-next-line @next/next/no-img-element
<img
src={post.media_url}
alt={post.body || label}
className="exploreMedia"
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
}}
/>
)
) : null}

<div className="exploreTopFade" />

{isVideo ? <div className="explorePill">Video</div> : null}

<div className="exploreInfoOverlay">
{profile?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={profile.avatar_url}
alt={label}
onClick={(e) => {
e.stopPropagation();
e.preventDefault();
if (profile?.id) router.push(`/u/${profile.id}`);
}}
style={{
width: 38,
height: 38,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(180,120,255,0.22)",
flexShrink: 0,
cursor: "pointer",
}}
/>
) : (
<div
onClick={(e) => {
e.stopPropagation();
e.preventDefault();
if (profile?.id) router.push(`/u/${profile.id}`);
}}
style={{
width: 38,
height: 38,
borderRadius: 999,
display: "grid",
placeItems: "center",
border: "1px solid rgba(180,120,255,0.22)",
background: "rgba(0,0,0,0.45)",
color: "rgba(255,255,255,0.92)",
fontWeight: 800,
flexShrink: 0,
cursor: "pointer",
}}
>
{label.trim().charAt(0).toUpperCase()}
</div>
)}

<div style={{ minWidth: 0, flex: 1 }}>
<div
onClick={(e) => {
e.stopPropagation();
e.preventDefault();
if (profile?.id) router.push(`/u/${profile.id}`);
}}
style={{
fontWeight: 850,
fontSize: 14,
color: "#fff",
textShadow: "0 1px 6px rgba(0,0,0,0.8)",
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
cursor: "pointer",
}}
>
{label}
</div>

<div
style={{
display: "flex",
gap: 8,
alignItems: "center",
flexWrap: "wrap",
marginTop: 2,
color: "rgba(255,255,255,0.85)",
textShadow: "0 1px 4px rgba(0,0,0,0.8)",
fontSize: 12,
}}
>
{handle ? <span>{handle}</span> : null}
<span>{timeAgo(post.created_at)}</span>
</div>
</div>
</div>
</div>
</div>
);
})}
</div>
)}
</div>
);
}