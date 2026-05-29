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
moderation_status?: string | null;
};


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

const { data: sessionData } = await supabase.auth.getSession();


const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type")
.not("media_url", "is", null)
.or("is_locked.eq.false,is_locked.is.null")
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



const userIds = Array.from(new Set(rows.map((p) => p.user_id).filter(Boolean)));

if (!userIds.length) {
setProfilesById({});
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

setProfilesById(map);
setPosts(rows.filter((post) => activeUserIds.has(post.user_id)));
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




.explorePill {
position: absolute;
top: 10px;
right: 58px;
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
gridTemplateColumns: "repeat(3, 1fr)",
gap: 4,
}}
>
{posts.map((post) => {
const profile = profilesById[post.user_id];
const label = profile?.display_name || profile?.username || "Unknown";
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
aspectRatio: "1 / 1",
overflow: "hidden",
borderRadius: 0,
background: "black",
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
</div>
</div>
);
})}
</div>
)}
</div>
);
}