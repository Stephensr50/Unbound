"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type PostMediaRow = {
id?: number;
post_id: number;
media_url: string | null;
media_bucket: string | null;
media_path: string | null;
media_type: string | null;
sort_order: number | null;
signed_url?: string | null;
};

type ExplorePostRow = {
id: number;
user_id: string;
body: string | null;
kind: string;
created_at: string;
media_url: string | null;
media_bucket: string | null;
media_path: string | null;
media_type: string | null;
signed_url?: string | null;
media_items?: PostMediaRow[];
};

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
moderation_status?: string | null;
};

type ExploreMode = "photos" | "videos";

function normalizeSearch(value: string) {
return value.trim().replace(/^#/, "").toLowerCase();
}

function bodyMatchesSearch(body: string | null, search: string) {
const q = normalizeSearch(search);
if (!q) return true;

const text = (body ?? "").toLowerCase();
return text.includes(q) || text.includes(`#${q}`);
}

function isVideoPost(post: ExplorePostRow) {
return (
(post.media_type && post.media_type.startsWith("video/")) ||
post.kind === "video"
);
}

export default function ExplorePage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();
const searchParams = useSearchParams();
const tagFromUrl = searchParams.get("tag") ?? "";

const [allPosts, setAllPosts] = useState<ExplorePostRow[]>([]);
const [posts, setPosts] = useState<ExplorePostRow[]>([]);
const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
{}
);
const [loading, setLoading] = useState(true);
const [banner, setBanner] = useState<string | null>(null);
const [search, setSearch] = useState(tagFromUrl);
const [mode, setMode] = useState<ExploreMode>("photos");

useEffect(() => {
setSearch(tagFromUrl);
}, [tagFromUrl]);

useEffect(() => {
let alive = true;

async function loadExplore() {
try {
setLoading(true);
setBanner(null);

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_path,media_type,media_bucket,is_locked")
.not("media_url", "is", null)
.eq("show_on_explore", true)
.or("is_locked.eq.false,is_locked.is.null")
.order("created_at", { ascending: false })
.limit(30);

if (error) throw error;
if (!alive) return;

let rawRows = ((data ?? []) as ExplorePostRow[]).filter(
(p) => !!p.media_url || !!p.media_path
);
const postIds = rawRows.map((p) => p.id);

if (postIds.length) {
const { data: mediaRows, error: mediaRowsError } = await supabase
.from("post_media")
.select("id,post_id,media_url,media_bucket,media_path,media_type,sort_order")
.in("post_id", postIds)
.order("sort_order", { ascending: true });

if (mediaRowsError) throw mediaRowsError;

const signedMediaRows = await Promise.all(
((mediaRows ?? []) as PostMediaRow[]).map(async (m) => {
if (m.media_bucket && m.media_path) {
const { data: signedData } = await supabase.storage
.from(m.media_bucket)
.createSignedUrl(m.media_path, 60 * 60 * 24);

return {
...m,
signed_url: signedData?.signedUrl ?? null,
};
}

return m;
})
);

const mediaByPostId: Record<number, PostMediaRow[]> = {};

for (const m of signedMediaRows) {
if (!mediaByPostId[m.post_id]) mediaByPostId[m.post_id] = [];
mediaByPostId[m.post_id].push(m);
}

rawRows = rawRows.map((p) => ({
...p,
media_items: mediaByPostId[p.id] ?? [],
}));
}
const seen = new Set<string>();
const rows: ExplorePostRow[] = [];

for (const post of rawRows) {
const key = `${post.user_id}::${post.media_url}`;
if (seen.has(key)) continue;
seen.add(key);
rows.push(post);
}
const rowsNeedingSignedUrls = rows.filter(
(p) => p.media_bucket && p.media_path
);

if (rowsNeedingSignedUrls.length) {
const signedRows = await Promise.all(
rowsNeedingSignedUrls.map(async (p) => {
const { data: signedData } = await supabase.storage
.from(p.media_bucket!)
.createSignedUrl(p.media_path!, 60 * 60);

return {
id: p.id,
signed_url: signedData?.signedUrl ?? null,
};
})
);

const signedMap = new Map(
signedRows.map((row) => [row.id, row.signed_url])
);

for (let i = 0; i < rows.length; i++) {
const signedUrl = signedMap.get(rows[i].id);

if (signedUrl) {
rows[i] = {
...rows[i],
media_url: signedUrl,
};
}
}
}
const userIds = Array.from(
new Set(rows.map((p) => p.user_id).filter(Boolean))
);

if (!userIds.length) {
setProfilesById({});
setAllPosts([]);
setPosts([]);
return;
}

const { data: profs, error: profErr } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url,moderation_status")
.in("id", userIds);

if (profErr) throw profErr;
if (!alive) return;

const activeProfiles = ((profs ?? []) as ProfileRow[]).filter(
(p) => (p.moderation_status ?? "active") === "active"
);

const activeUserIds = new Set(activeProfiles.map((p) => p.id));

const map: Record<string, ProfileRow> = {};
for (const p of activeProfiles) {
map[p.id] = p;
}

const cleanRows = rows.filter((post) => activeUserIds.has(post.user_id));

setProfilesById(map);
setAllPosts(cleanRows);
setPosts(cleanRows);
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

useEffect(() => {
const q = normalizeSearch(search);

const filtered = allPosts.filter((post) => {
const matchesSearch = !q || bodyMatchesSearch(post.body, q);
const matchesMode = mode === "videos" ? isVideoPost(post) : !isVideoPost(post);

return matchesSearch && matchesMode;
});

setPosts(filtered);
}, [search, allPosts, mode]);

const tabStyle = (active: boolean): React.CSSProperties => ({
padding: "9px 18px",
borderRadius: 999,
border: active
? "1px solid rgba(236,72,153,0.95)"
: "1px solid rgba(180,120,255,0.25)",
background: active
? "linear-gradient(180deg, rgba(240,32,139,0.95), rgba(192,38,211,0.85))"
: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 900,
boxShadow: active
? "0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)"
: undefined,
});

return (
<div style={{ maxWidth: 1240, margin: "0 auto", padding: 16 }}>
<style>{`
.exploreSearch {
width: 100%;
max-width: 520px;
padding: 13px 16px;
border-radius: 999px;
border: 1px solid rgba(236, 72, 154, 0.45);
background: rgba(0,0,0,0.52);
color: white;
outline: none;
font-size: 15px;
box-shadow: 0 0 22px rgba(168, 85, 247, 0.18);
}

.exploreSearch::placeholder {
color: rgba(255,255,255,0.52);
}

.exploreSearch:focus {
border-color: rgba(236, 72, 154, 0.85);
box-shadow: 0 0 26px rgba(236, 72, 154, 0.26);
}

.exploreCard {
border: none;
background: transparent;
border-radius: 0;
overflow: hidden;
padding: 0;
cursor: pointer;
text-align: left;
}

.exploreCard:hover {
transform: none;
box-shadow: none;
background: transparent;
}

.exploreMedia {
transition: transform 0.24s ease, filter 0.24s ease;
}

.exploreCard:hover .exploreMedia {
transform: scale(1.035);
filter: brightness(1.04);
}
`}</style>

<div style={{ marginBottom: 18 }}>
<div
style={{
fontSize: 46,
fontWeight: 900,
lineHeight: 1,
marginBottom: 14,
}}
>
Explore
</div>

<input
className="exploreSearch"
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search #hashtags or posts..."
/>

<div
style={{
display: "flex",
gap: 10,
marginTop: 14,
flexWrap: "wrap",
}}
>
<button
type="button"
onClick={() => setMode("photos")}
style={tabStyle(mode === "photos")}
>
Photos
</button>

<button
type="button"
onClick={() => setMode("videos")}
style={tabStyle(mode === "videos")}
>
Videos
</button>
</div>
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
gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
gap: 18,
}}
>
{Array.from({ length: 8 }).map((_, i) => (
<div
key={i}
style={{
aspectRatio: "4 / 5",
borderRadius: 20,
border: "1px solid rgba(236, 72, 153, 0.18)",
background: "rgba(0,0,0,0.18)",
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
No matching {mode === "photos" ? "photo" : "video"} posts found.
</div>
) : (
<div
style={{
display: "grid",
gridTemplateColumns: "repeat(3, 1fr)",
gap: 4,
}}
>
{posts.map((post) => {
const profile = profilesById[post.user_id];
const label = profile?.display_name || profile?.username || "Unknown";
const isVideo = isVideoPost(post);
const mediaItems =
post.media_items && post.media_items.length > 0
? post.media_items
: [];

const firstMedia = mediaItems[0];
const mediaSrc =
firstMedia?.signed_url ||
firstMedia?.media_url ||
post.signed_url ||
post.media_url;

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
aspectRatio: "1 / 1",
overflow: "hidden",
borderRadius: 0,
background: "black",
}}
>
{mediaSrc ? (
isVideo ? (
<video
src={mediaSrc}
muted
playsInline
preload="auto"
className="exploreMedia"
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
}}
/>
) : (
<div
onContextMenu={(e) => e.preventDefault()}
onDragStart={(e) => e.preventDefault()}
style={{
position: "relative",
width: "100%",
height: "100%",
userSelect: "none",
WebkitUserSelect: "none",
WebkitTouchCallout: "none",
}}
>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
src={post.media_url}
alt={post.body || label}
draggable={false}
className="exploreMedia"
onContextMenu={(e) => e.preventDefault()}
onDragStart={(e) => e.preventDefault()}
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
pointerEvents: "none",
userSelect: "none",
WebkitUserSelect: "none",
WebkitTouchCallout: "none",
}}
/>

<div
aria-hidden="true"
style={{
position: "absolute",
inset: 0,
background: "transparent",
}}
/>
</div>
)
) : null}
{mediaItems.length > 1 ? (
<div
style={{
position: "absolute",
left: 0,
right: 0,
bottom: 8,
display: "flex",
justifyContent: "center",
gap: 5,
pointerEvents: "none",
}}
>
{mediaItems.slice(0, 5).map((_, index) => (
<span
key={`explore-dot-${post.id}-${index}`}
style={{
width: 6,
height: 6,
borderRadius: "50%",
background: index === 0 ? "#ec4899" : "#8b5cf6",
boxShadow:
index === 0
? "0 0 8px rgba(236,72,153,0.9)"
: "0 0 6px rgba(139,92,246,0.55)",
}}
/>
))}
</div>
) : null}
</div>
</div>
);
})}
</div>
)}
</div>
);
}