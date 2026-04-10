"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import PublicProfileActions from "./PublicProfileActions";
import ReactionBar from "@/app/components/ReactionBar";

type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";
type ReactionCountsMap = Partial<Record<ReactionKey, number>>;

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
media_type?: string | null;
group_id?: number | null;
};

type GroupRow = {
id: number;
name: string;
slug: string;
avatar_url?: string | null;
};

type CommentRow = {
id: number;
post_id: number;
user_id: string;
body: string;
created_at: string;
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
const [groupsById, setGroupsById] = useState<Record<number, GroupRow>>({});

const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
const [reactionCountsByPost, setReactionCountsByPost] = useState<
Record<number, ReactionCountsMap>
>({});
const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
const [likedByMe, setLikedByMe] = useState<Record<number, boolean>>({});
const [myReactionByPost, setMyReactionByPost] = useState<
Record<number, ReactionKey | undefined>
>({});
const [openReactionPicker, setOpenReactionPicker] = useState<
Record<number, boolean>
>({});

const [busyPostId, setBusyPostId] = useState<number | null>(null);
const [spark, setSpark] = useState<Record<number, boolean>>({});

const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
const [commentsByPost, setCommentsByPost] = useState<Record<number, CommentRow[]>>(
{}
);
const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadCounts(postIds: number[], uid: string | null) {
if (!postIds.length) {
setLikeCounts({});
setReactionCountsByPost({});
setLikedByMe({});
setMyReactionByPost({});
setCommentCounts({});
return;
}

const { data: likeRows, error: likeErr } = await supabase
.from("post_likes")
.select("post_id,user_id,reaction")
.in("post_id", postIds);

if (likeErr) {
setBanner(likeErr.message);
return;
}

const lc: Record<number, number> = {};
const lbm: Record<number, boolean> = {};
const reactionsByMe: Record<number, ReactionKey | undefined> = {};
const reactionTotals: Record<number, ReactionCountsMap> = {};

for (const r of likeRows ?? []) {
const pid = (r as any).post_id as number;
const likerId = (r as any).user_id as string;
const reaction = (((r as any).reaction || "devil") as ReactionKey) ?? "devil";

lc[pid] = (lc[pid] ?? 0) + 1;

if (!reactionTotals[pid]) {
reactionTotals[pid] = {};
}
reactionTotals[pid][reaction] =
(reactionTotals[pid][reaction] ?? 0) + 1;

if (uid && likerId === uid) {
lbm[pid] = true;
reactionsByMe[pid] = reaction;
}
}

const { data: commentRows, error: commentErr } = await supabase
.from("post_comments")
.select("post_id")
.in("post_id", postIds);

if (commentErr) {
setLikeCounts(lc);
setReactionCountsByPost(reactionTotals);
setLikedByMe(lbm);
setMyReactionByPost(reactionsByMe);
setCommentCounts({});
return;
}

const cc: Record<number, number> = {};
for (const r of commentRows ?? []) {
const pid = (r as any).post_id as number;
cc[pid] = (cc[pid] ?? 0) + 1;
}

setLikeCounts(lc);
setReactionCountsByPost(reactionTotals);
setLikedByMe(lbm);
setMyReactionByPost(reactionsByMe);
setCommentCounts(cc);
}

async function loadGroups(groupIds: number[]) {
if (!groupIds.length) {
setGroupsById({});
return;
}

const { data, error } = await supabase
.from("groups")
.select("id,name,slug,avatar_url")
.in("id", groupIds);

if (error) {
setBanner(error.message);
return;
}

const map: Record<number, GroupRow> = {};
for (const g of (data ?? []) as GroupRow[]) {
map[g.id] = g;
}
setGroupsById(map);
}

async function loadProfilePosts(targetUserId: string, viewerId: string | null) {
setBanner(null);

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type,group_id")
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

const groupIds = Array.from(
new Set(
rows
.map((p) => p.group_id)
.filter((id): id is number => typeof id === "number")
)
);

await loadGroups(groupIds);

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

function closeReactionPicker(postId: number) {
setOpenReactionPicker((m) => ({ ...m, [postId]: false }));
}

function toggleReactionPicker(postId: number) {
setOpenReactionPicker((m) => ({ ...m, [postId]: !m[postId] }));
}

async function setReaction(postId: number, reaction: ReactionKey = "devil") {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

if (busyPostId) return;
setBusyPostId(postId);
setBanner(null);

const currentReaction = myReactionByPost[postId];
const already = !!likedByMe[postId];

if (already && currentReaction === reaction) {
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
setMyReactionByPost((m) => ({ ...m, [postId]: undefined }));
setLikeCounts((m) => ({
...m,
[postId]: Math.max(0, (m[postId] ?? 0) - 1),
}));
setReactionCountsByPost((m) => {
const current = { ...(m[postId] ?? {}) };
if (currentReaction) {
current[currentReaction] = Math.max(
0,
(current[currentReaction] ?? 0) - 1
);
if ((current[currentReaction] ?? 0) === 0) {
delete current[currentReaction];
}
}
return { ...m, [postId]: current };
});
closeReactionPicker(postId);
setBusyPostId(null);
return;
}

if (already && currentReaction && currentReaction !== reaction) {
const { error } = await supabase
.from("post_likes")
.update({ reaction })
.eq("post_id", postId)
.eq("user_id", uid);

if (error) {
setBanner(error.message);
setBusyPostId(null);
return;
}

setLikedByMe((m) => ({ ...m, [postId]: true }));
setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
setReactionCountsByPost((m) => {
const current = { ...(m[postId] ?? {}) };
current[currentReaction] = Math.max(
0,
(current[currentReaction] ?? 0) - 1
);
if ((current[currentReaction] ?? 0) === 0) {
delete current[currentReaction];
}
current[reaction] = (current[reaction] ?? 0) + 1;
return { ...m, [postId]: current };
});
triggerSpark(postId);
closeReactionPicker(postId);
setBusyPostId(null);
return;
}

const { error } = await supabase.from("post_likes").insert({
post_id: postId,
user_id: uid,
reaction,
});

if (error) {
const isConflict =
(error as any)?.status === 409 ||
(error as any)?.code === "23505" ||
String((error as any)?.message || "")
.toLowerCase()
.includes("duplicate") ||
String((error as any)?.message || "")
.toLowerCase()
.includes("unique");

if (isConflict) {
const { error: updateErr } = await supabase
.from("post_likes")
.update({ reaction })
.eq("post_id", postId)
.eq("user_id", uid);

if (updateErr) {
setBanner(updateErr.message);
setBusyPostId(null);
return;
}

setLikedByMe((m) => ({ ...m, [postId]: true }));
setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
setReactionCountsByPost((m) => {
const current = { ...(m[postId] ?? {}) };
const prev = currentReaction;
if (prev) {
current[prev] = Math.max(0, (current[prev] ?? 0) - 1);
if ((current[prev] ?? 0) === 0) {
delete current[prev];
}
}
current[reaction] = (current[reaction] ?? 0) + 1;
return { ...m, [postId]: current };
});
triggerSpark(postId);
closeReactionPicker(postId);
setBusyPostId(null);
return;
}

setBanner(error.message);
setBusyPostId(null);
return;
}

setLikedByMe((m) => ({ ...m, [postId]: true }));
setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
setLikeCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
setReactionCountsByPost((m) => ({
...m,
[postId]: {
...(m[postId] ?? {}),
[reaction]: ((m[postId] ?? {})[reaction] ?? 0) + 1,
},
}));
triggerSpark(postId);
closeReactionPicker(postId);
setBusyPostId(null);
}

async function toggleSpank(postId: number) {
const existing = myReactionByPost[postId];
await setReaction(postId, existing || "devil");
}

async function openCommentsFor(postId: number) {
setOpenComments((m) => ({ ...m, [postId]: !m[postId] }));

if (commentsByPost[postId]) return;

const { data, error } = await supabase
.from("post_comments")
.select("id,post_id,user_id,body,created_at")
.eq("post_id", postId)
.order("created_at", { ascending: true })
.limit(50);

if (error) {
setBanner(error.message);
return;
}

setCommentsByPost((m) => ({
...m,
[postId]: (data ?? []) as CommentRow[],
}));
}

async function addComment(postId: number) {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

const body = (commentDraft[postId] ?? "").trim();
if (!body) return;

const { data, error } = await supabase
.from("post_comments")
.insert({ post_id: postId, user_id: uid, body })
.select("id,post_id,user_id,body,created_at")
.single();

if (error) {
setBanner(error.message);
return;
}

setCommentsByPost((m) => ({
...m,
[postId]: [...(m[postId] ?? []), data as CommentRow],
}));

setCommentDraft((m) => ({ ...m, [postId]: "" }));
setCommentCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
setOpenComments((m) => ({ ...m, [postId]: true }));
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

const groupPill: React.CSSProperties = {
display: "inline-flex",
alignItems: "center",
gap: 8,
marginBottom: 10,
padding: "6px 10px",
borderRadius: 999,
background: "rgba(168,85,247,0.18)",
border: "1px solid rgba(168,85,247,0.45)",
boxShadow: "0 0 12px rgba(168,85,247,0.35)",
color: "rgba(240,220,255,0.96)",
fontSize: 12,
fontWeight: 700,
};

const groupLinkStyle: React.CSSProperties = {
color: "inherit",
textDecoration: "none",
};

const inputStyle: React.CSSProperties = {
background: "rgba(0,0,0,0.6)",
color: "white",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 12,
padding: "10px 12px",
outline: "none",
};

const profileCard: React.CSSProperties = {
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(180,120,255,0.16)",
borderRadius: 18,
padding: 18,
marginBottom: 18,
};

const postBtn: React.CSSProperties = {
padding: "8px 16px",
borderRadius: 999,
border: "none",
cursor: "pointer",
color: "white",
fontWeight: 700,
background: "linear-gradient(90deg,#7c3aed,#c026d3)",
boxShadow: "0 0 14px rgba(168,85,247,0.6)",
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

const isBusy = busyPostId === p.id;
const isOpen = !!openComments[p.id];
const groupInfo =
typeof p.group_id === "number" ? groupsById[p.group_id] : null;

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

{groupInfo ? (
<div style={groupPill}>
{groupInfo.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={groupInfo.avatar_url}
alt=""
style={{
width: 18,
height: 18,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.18)",
}}
/>
) : null}

<span>Group ·</span>

<Link href={`/groups/${groupInfo.slug}`} style={groupLinkStyle}>
{groupInfo.name}
</Link>
</div>
) : null}

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

<ReactionBar
postId={p.id}
spanks={likeCounts[p.id] ?? 0}
comments={commentCounts[p.id] ?? 0}
iSpanked={!!likedByMe[p.id]}
myReaction={myReactionByPost[p.id]}
isBusy={isBusy}
isPickerOpen={!!openReactionPicker[p.id]}
sparkOn={!!spark[p.id]}
pillBtn={pillBtn}
reactionCounts={reactionCountsByPost[p.id]}
onToggleSpank={toggleSpank}
onTogglePicker={toggleReactionPicker}
onSetReaction={setReaction}
onOpenComments={openCommentsFor}
/>

{isOpen ? (
<div style={{ marginTop: 12 }}>
<div style={{ display: "flex", gap: 10 }}>
<input
value={commentDraft[p.id] ?? ""}
onChange={(e) =>
setCommentDraft((m) => ({ ...m, [p.id]: e.target.value }))
}
placeholder="Write a comment…"
style={{ ...inputStyle, flex: 1 }}
/>

<button
onClick={() => addComment(p.id)}
disabled={isBusy}
style={postBtn}
>
{isBusy ? "…" : "Send"}
</button>
</div>

<div
style={{
marginTop: 10,
display: "flex",
flexDirection: "column",
gap: 10,
}}
>
{(commentsByPost[p.id] ?? []).map((c) => (
<div
key={c.id}
style={{
background: "rgba(0,0,0,0.35)",
border: "1px solid #222",
borderRadius: 14,
padding: 10,
}}
>
<div style={{ opacity: 0.6, fontSize: 12, marginBottom: 6 }}>
{timeAgo(c.created_at)}
</div>
<div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
</div>
))}

{(commentsByPost[p.id] ?? []).length === 0 ? (
<div style={{ opacity: 0.6, fontSize: 13, marginTop: 6 }}>
No comments yet.
</div>
) : null}
</div>
</div>
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