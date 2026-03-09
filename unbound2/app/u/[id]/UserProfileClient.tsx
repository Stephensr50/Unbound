"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import PublicProfileActions from "./PublicProfileActions";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
bio: string | null;
avatar_url: string | null;
location?: string | null;
};

type PostRow = {
id: number;
user_id: string;
body: string | null;
kind: string | null;
created_at: string;
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

export default function UserProfileClient({ profile }: { profile: ProfileRow }) {
const supabase = useMemo(() => getSupabase(), []);

const [myUserId, setMyUserId] = useState<string | null>(null);
const [posts, setPosts] = useState<PostRow[]>([]);
const [banner, setBanner] = useState<string | null>(null);

const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
const [likedByMe, setLikedByMe] = useState<Record<number, boolean>>({});
const [busyPostId, setBusyPostId] = useState<number | null>(null);
const [spark, setSpark] = useState<Record<number, boolean>>({});

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadCounts(postIds: number[], uid: string | null) {
if (!postIds.length) {
setLikeCounts({});
setLikedByMe({});
setCommentCounts({});
return;
}

const { data: likeRows, error: likeErr } = await supabase
.from("post_likes")
.select("post_id,user_id")
.in("post_id", postIds);

if (likeErr) {
setBanner(likeErr.message);
return;
}

const lc: Record<number, number> = {};
const lbm: Record<number, boolean> = {};

for (const r of likeRows ?? []) {
const pid = (r as any).post_id as number;
const likerId = (r as any).user_id as string;
lc[pid] = (lc[pid] ?? 0) + 1;
if (uid && likerId === uid) lbm[pid] = true;
}

const { data: commentRows, error: commentErr } = await supabase
.from("post_comments")
.select("post_id")
.in("post_id", postIds);

if (commentErr) {
setLikeCounts(lc);
setLikedByMe(lbm);
setCommentCounts({});
return;
}

const cc: Record<number, number> = {};
for (const r of commentRows ?? []) {
const pid = (r as any).post_id as number;
cc[pid] = (cc[pid] ?? 0) + 1;
}

setLikeCounts(lc);
setLikedByMe(lbm);
setCommentCounts(cc);
}

async function loadProfilePosts(targetUserId: string, viewerId: string | null) {
setBanner(null);

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type")
.eq("user_id", targetUserId)
.order("created_at", { ascending: false })
.limit(50);

if (error) {
setBanner(error.message);
setPosts([]);
return;
}

const rows = (data ?? []) as PostRow[];
setPosts(rows);
await loadCounts(
rows.map((p) => p.id),
viewerId
);
}

useEffect(() => {
(async () => {
const uid = await refreshAuth();
await loadProfilePosts(profile.id, uid);
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [profile.id]);

function triggerSpark(postId: number) {
setSpark((m) => ({ ...m, [postId]: true }));
window.setTimeout(() => {
setSpark((m) => ({ ...m, [postId]: false }));
}, 260);
}

async function toggleSpank(postId: number) {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

if (busyPostId) return;
setBusyPostId(postId);

const already = !!likedByMe[postId];

if (already) {
const { error } = await supabase
.from("post_likes")
.delete()
.eq("post_id", postId)
.eq("user_id", uid);

if (error) {
setBanner(error.message);
setBusyPostId(null);
return;
}

setLikedByMe((m) => ({ ...m, [postId]: false }));
setLikeCounts((m) => ({
...m,
[postId]: Math.max(0, (m[postId] ?? 0) - 1),
}));
setBusyPostId(null);
return;
}

const { error: insErr } = await supabase.from("post_likes").insert({
post_id: postId,
user_id: uid,
});

if (!insErr) {
setLikedByMe((m) => ({ ...m, [postId]: true }));
setLikeCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
triggerSpark(postId);
setBusyPostId(null);
return;
}

const isConflict =
(insErr as any)?.status === 409 ||
(insErr as any)?.code === "23505" ||
String((insErr as any)?.message || "").toLowerCase().includes("duplicate") ||
String((insErr as any)?.message || "").toLowerCase().includes("unique");

if (isConflict) {
const { error: delErr } = await supabase
.from("post_likes")
.delete()
.eq("post_id", postId)
.eq("user_id", uid);

if (delErr) {
setBanner(delErr.message);
setBusyPostId(null);
return;
}

setLikedByMe((m) => ({ ...m, [postId]: false }));
setLikeCounts((m) => ({
...m,
[postId]: Math.max(0, (m[postId] ?? 0) - 1),
}));
setBusyPostId(null);
return;
}

setBanner(insErr.message);
setBusyPostId(null);
}

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

const pillBtn: React.CSSProperties = {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 650,
};

const profileCard: React.CSSProperties = {
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(180,120,255,0.16)",
borderRadius: 18,
padding: 18,
marginBottom: 18,
};

return (
<div style={{ width: "min(920px, 94vw)", margin: "16px auto 0" }}>
<style>{`
@keyframes unboundPop {
0% { transform: scale(1); }
45% { transform: scale(1.22); }
100% { transform: scale(1); }
}
`}</style>

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

<div style={profileCard}>
<div
style={{
display: "flex",
gap: 16,
alignItems: "flex-start",
flexWrap: "wrap",
}}
>
{profile.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={profile.avatar_url}
alt=""
style={{
width: 104,
height: 104,
borderRadius: 18,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.16)",
flex: "0 0 auto",
}}
/>
) : (
<div
style={{
width: 104,
height: 104,
borderRadius: 18,
display: "grid",
placeItems: "center",
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(255,255,255,0.04)",
opacity: 0.7,
flex: "0 0 auto",
}}
>
?
</div>
)}

<div style={{ flex: 1, minWidth: 220 }}>
<div style={{ fontSize: 24, fontWeight: 850 }}>
{profile.display_name || profile.username || "Unknown"}
</div>

{profile.username ? (
<div style={{ opacity: 0.85, marginTop: 4 }}>@{profile.username}</div>
) : null}

{profile.location ? (
<div style={{ opacity: 0.85, marginTop: 6 }}>{profile.location}</div>
) : null}

{profile.bio ? (
<div style={{ opacity: 0.95, marginTop: 10, whiteSpace: "pre-wrap" }}>
{profile.bio}
</div>
) : null}

<div style={{ marginTop: 14 }}>
<PublicProfileActions targetProfileId={profile.id} />
</div>
</div>
</div>
</div>

<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
{posts.map((p) => {
const media = p.media_url ?? p.image_url ?? p.file_url ?? null;

const isVideo =
(p.kind ?? "").toLowerCase().includes("video") ||
(!!media && /\.(mp4|webm|mov)(\?|$)/i.test(media));

const isPhoto =
(p.kind ?? "").toLowerCase().includes("photo") ||
(p.kind ?? "").toLowerCase().includes("image") ||
(!!media && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(media));

const spanks = likeCounts[p.id] ?? 0;
const comments = commentCounts[p.id] ?? 0;
const iSpanked = !!likedByMe[p.id];
const isBusy = busyPostId === p.id;

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
{profile.username ? `@${profile.username}` : ""}
</div>
</div>

{p.body ? (
<div style={{ fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{p.body}
</div>
) : null}

{media && (isPhoto || isVideo) ? (
isVideo ? (
<video src={media} controls style={mediaStyle} />
) : (
// eslint-disable-next-line @next/next/no-img-element
<img src={media} alt="" style={mediaStyle} />
)
) : null}

<div
style={{
display: "flex",
gap: 14,
marginTop: 12,
alignItems: "center",
}}
>
<button
onClick={() => !isBusy && toggleSpank(p.id)}
disabled={isBusy}
style={{
...pillBtn,
display: "flex",
alignItems: "center",
gap: 8,
opacity: isBusy ? 0.6 : 1,
animation: spark[p.id] ? "unboundPop .22s ease" : undefined,
color: iSpanked ? "#e879f9" : "white",
border: iSpanked
? "1px solid rgba(192,38,211,0.55)"
: "1px solid rgba(180,120,255,0.25)",
background: iSpanked
? "rgba(192,38,211,0.16)"
: "rgba(0,0,0,0.35)",
}}
title="Spank"
>
<span
style={{
fontSize: 18,
lineHeight: 1,
display: "inline-flex",
}}
>
{iSpanked ? "♥" : "♡"}
</span>

<span>
{iSpanked ? "Spanked" : "Spank"}
{spanks ? ` · ${spanks}` : ""}
</span>
</button>

<button style={pillBtn}>
Comments {comments ? `· ${comments}` : ""}
</button>
</div>
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