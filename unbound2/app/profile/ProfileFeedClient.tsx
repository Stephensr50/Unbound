"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import ReactionBar from "../components/ReactionBar";
import ReportCommentButton from "../components/ReportCommentButton";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";
type ReactionCountsMap = Partial<Record<ReactionKey, number>>;
type ProfileTab = "posts" | "photos" | "videos";
type RelationshipTab = "followers" | "following" | "friends";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
bio?: string | null;
avatar_url: string | null;
location?: string | null;
relationship_status?: string | null;
orientation?: string | null;
pronouns?: string | null;
looking_for?: string | null;
ds_relationship?: string | null;
};

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
media_bucket?: string | null;
media_path?: string | null;
signed_url?: string | null;
media_items?: PostMediaRow[];
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

type GalleryItem = {
postId: number;
url: string;
type: "image" | "video";
caption: string | null;
createdAt: string;
};

const REACTIONS: Record<ReactionKey, string> = {
devil: "😈",
fire: "🔥",
eyes: "👀",
purple_heart: "💜",
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

function getPostMedia(post: PostRow) {
return post.media_url ?? post.image_url ?? post.file_url ?? null;
}

function isVideoPost(post: PostRow) {
const media = getPostMedia(post);
return (
(post.kind ?? "").toLowerCase().includes("video") ||
(!!post.media_type && post.media_type.toLowerCase().startsWith("video/")) ||
(!!media && /\.(mp4|webm|mov)(\?|$)/i.test(media))
);
}

function isPhotoPost(post: PostRow) {
const media = getPostMedia(post);
return (
(post.kind ?? "").toLowerCase().includes("photo") ||
(post.kind ?? "").toLowerCase().includes("image") ||
(!!post.media_type && post.media_type.toLowerCase().startsWith("image/")) ||
(!!media && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(media))
);
}

export default function ProfileFeedClient() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [myUserId, setMyUserId] = useState<string | null>(null);
const [myProfile, setMyProfile] = useState<ProfileRow | null>(null);

const [posts, setPosts] = useState<PostRow[]>([]);
const [banner, setBanner] = useState<string | null>(null);
const [groupsById, setGroupsById] = useState<Record<number, GroupRow>>({});
const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

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

const [pendingDeletePost, setPendingDeletePost] = useState<PostRow | null>(null);
const [spark, setSpark] = useState<Record<number, boolean>>({});

const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
const [commentsByPost, setCommentsByPost] = useState<Record<number, CommentRow[]>>(
{}
);
const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});

const [relationshipCounts, setRelationshipCounts] = useState({
followers: 0,
following: 0,
friends: 0,
});
const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
const [relationshipTab, setRelationshipTab] = useState<RelationshipTab>("followers");
const [relationshipLoading, setRelationshipLoading] = useState(false);
const [relationshipProfiles, setRelationshipProfiles] = useState<ProfileRow[]>([]);

const [gallery, setGallery] = useState<{
items: GalleryItem[];
index: number;
} | null>(null);
const [galleryIndex, setGalleryIndex] = useState<Record<number, number>>({});
const touchStartXRef = useRef<Record<number, number>>({});

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadMyProfile(uid: string) {
const { data, error } = await supabase
.from("profiles")
.select("id,username,display_name,bio,avatar_url,location,relationship_status,orientation,pronouns,looking_for,ds_relationship")
.eq("id", uid)
.maybeSingle();

if (!error && data) {
setMyProfile(data as ProfileRow);
}
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

async function loadRelationshipCounts(uid: string) {
try {
const [followersRes, followingRes, friendsLeftRes, friendsRightRes] =
await Promise.all([
supabase
.from("follows")
.select("follower_id", { count: "exact" })
.eq("following_id", uid),
supabase
.from("follows")
.select("following_id", { count: "exact" })
.eq("follower_id", uid),
supabase.from("friends").select("friend_id").eq("user_id", uid),
supabase.from("friends").select("user_id").eq("friend_id", uid),
]);

const friendIds = new Set<string>();
for (const row of friendsLeftRes.data ?? []) {
const id = (row as any).friend_id as string;
if (id) friendIds.add(id);
}
for (const row of friendsRightRes.data ?? []) {
const id = (row as any).user_id as string;
if (id) friendIds.add(id);
}

setRelationshipCounts({
followers: followersRes.count ?? 0,
following: followingRes.count ?? 0,
friends: friendIds.size,
});
} catch {
// leave counts as-is
}
}

async function loadRelationshipProfiles(uid: string, mode: RelationshipTab) {
setRelationshipLoading(true);
try {
let ids: string[] = [];

if (mode === "followers") {
const { data, error } = await supabase
.from("follows")
.select("follower_id")
.eq("following_id", uid);

if (error) throw error;
ids = Array.from(
new Set((data ?? []).map((r: any) => String(r.follower_id)).filter(Boolean))
);
} else if (mode === "following") {
const { data, error } = await supabase
.from("follows")
.select("following_id")
.eq("follower_id", uid);

if (error) throw error;
ids = Array.from(
new Set((data ?? []).map((r: any) => String(r.following_id)).filter(Boolean))
);
} else {
const [left, right] = await Promise.all([
supabase.from("friends").select("friend_id").eq("user_id", uid),
supabase.from("friends").select("user_id").eq("friend_id", uid),
]);

if (left.error) throw left.error;
if (right.error) throw right.error;

const set = new Set<string>();
for (const row of left.data ?? []) {
const id = (row as any).friend_id as string;
if (id) set.add(id);
}
for (const row of right.data ?? []) {
const id = (row as any).user_id as string;
if (id) set.add(id);
}
ids = Array.from(set);
}

if (!ids.length) {
setRelationshipProfiles([]);
setRelationshipLoading(false);
return;
}

const { data: profs, error: profErr } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", ids);

if (profErr) throw profErr;

const rows = ((profs ?? []) as ProfileRow[]).sort((a, b) => {
const aName = (a.display_name || a.username || "").toLowerCase();
const bName = (b.display_name || b.username || "").toLowerCase();
return aName.localeCompare(bName);
});

setRelationshipProfiles(rows);
} catch (e: any) {
setBanner(e?.message || "Could not load profile list.");
setRelationshipProfiles([]);
} finally {
setRelationshipLoading(false);
}
}

async function openRelationshipModal(mode: RelationshipTab) {
if (!myUserId) return;
setRelationshipTab(mode);
setRelationshipModalOpen(true);
await loadRelationshipProfiles(myUserId, mode);
}

async function loadComments(postId: number) {
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

async function loadMyPosts(uid: string) {
setBanner(null);

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type,media_bucket,media_path,group_id")
.eq("user_id", uid)
.order("created_at", { ascending: false })
.limit(100);

if (error) {
setBanner(error.message);
setPosts([]);
return;
}

let rows = (data ?? []) as PostRow[];

const postIds = rows.map((p) => p.id);

if (postIds.length) {
const { data: mediaRows, error: mediaRowsError } = await supabase
.from("post_media")
.select("id,post_id,media_url,media_bucket,media_path,media_type,sort_order")
.in("post_id", postIds)
.order("sort_order", { ascending: true });

if (mediaRowsError) {
setBanner(mediaRowsError.message);
return;
}

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

rows = rows.map((p) => ({
...p,
media_items: mediaByPostId[p.id] ?? [],
}));
}

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
uid
);
}

useEffect(() => {
(async () => {
const uid = await refreshAuth();
if (!uid) {
setBanner("Not signed in.");
setPosts([]);
return;
}

await Promise.all([
loadMyProfile(uid),
loadMyPosts(uid),
loadRelationshipCounts(uid),
]);
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

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
const nextOpen = !openComments[postId];
setOpenComments((m) => ({ ...m, [postId]: nextOpen }));

if (nextOpen && !commentsByPost[postId]) {
await loadComments(postId);
}
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


async function deletePost(post: PostRow) {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

if (post.user_id !== uid) {
setBanner("You can only delete your own posts.");
return;
}



setBusyPostId(post.id);
setBanner(null);

try {
const media = getPostMedia(post);

if (media) {
try {
const url = new URL(media);
const marker = "/storage/v1/object/public/media/";
const idx = url.pathname.indexOf(marker);

if (idx >= 0) {
const path = decodeURIComponent(
url.pathname.slice(idx + marker.length)
);

if (path) {
await supabase.storage.from("media").remove([path]);
}
}
} catch {
// ignore storage cleanup errors
}
}

const { error } = await supabase
.from("posts")
.delete()
.eq("id", post.id)
.eq("user_id", uid);

if (error) throw error;

setPosts((rows) => rows.filter((row) => row.id !== post.id));
setLikeCounts((m) => {
const next = { ...m };
delete next[post.id];
return next;
});
setCommentCounts((m) => {
const next = { ...m };
delete next[post.id];
return next;
});
setReactionCountsByPost((m) => {
const next = { ...m };
delete next[post.id];
return next;
});
} catch (e: any) {
setBanner(e?.message || "Delete failed.");
} finally {
setBusyPostId(null);
}
}

function makeGalleryItems(items: PostRow[], mode: "photos" | "videos"): GalleryItem[] {
return items
.map((p) => {
const media = getPostMedia(p);
if (!media) return null;
return {
postId: p.id,
url: media,
type: mode === "photos" ? "image" : "video",
caption: p.body,
createdAt: p.created_at,
} as GalleryItem;
})
.filter(Boolean) as GalleryItem[];
}

function openGalleryForPost(postId: number, mode: "photos" | "videos") {
const source = mode === "photos" ? photoPosts : videoPosts;
const items = makeGalleryItems(source, mode);
const index = Math.max(
0,
items.findIndex((item) => item.postId === postId)
);
setGallery({ items, index });
}

function galleryPrev() {
setGallery((prev) => {
if (!prev || prev.items.length <= 1) return prev;
return {
...prev,
index: (prev.index - 1 + prev.items.length) % prev.items.length,
};
});
}

function galleryNext() {
setGallery((prev) => {
if (!prev || prev.items.length <= 1) return prev;
return {
...prev,
index: (prev.index + 1) % prev.items.length,
};
});
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
objectFit: "contain",
};

const pillBtn: React.CSSProperties = {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 700,
};

const tabBtn = (active: boolean): React.CSSProperties => ({
padding: "9px 14px",
borderRadius: 999,
border: active
? "1px solid rgba(236,72,153,0.8)"
: "1px solid rgba(180,120,255,0.25)",
background: active
? "linear-gradient(90deg,#ec4899,#c026d3)"
: "rgba(0,0,0,0.35)",
color: active ? "white" : "rgba(255,255,255,0.84)",
cursor: "pointer",
fontWeight: 800,
boxShadow: active
? "0 0 18px rgba(236,72,153,0.55)"
: "0 0 8px rgba(168,85,247,0.25)",
transition: "all 0.15s ease",
});

const countPill: React.CSSProperties = {
padding: "8px 12px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.45)",
background: "rgba(236,72,153,0.10)",
cursor: "pointer",
color: "white",
fontWeight: 800,
boxShadow: "0 0 10px rgba(236,72,153,0.18)",
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

const profileCard: React.CSSProperties = {
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(180,120,255,0.16)",
borderRadius: 18,
padding: 18,
marginBottom: 18,
};

const inputStyle: React.CSSProperties = {
background: "rgba(0,0,0,0.6)",
color: "white",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 12,
padding: "10px 12px",
outline: "none",
};

const postBtn: React.CSSProperties = {
padding: "8px 16px",
borderRadius: 999,
border: "none",
cursor: "pointer",
color: "white",
fontWeight: 700,
background: "linear-gradient(90deg,#ec4899,#c026d3)",
boxShadow: "0 0 16px rgba(236,72,153,0.45)",
};

const mediaGrid: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
gap: 14,
};

const mediaTile: React.CSSProperties = {
position: "relative",
borderRadius: 16,
overflow: "hidden",
border: "1px solid rgba(180,120,255,0.16)",
background: "rgba(0,0,0,0.42)",
cursor: "pointer",
aspectRatio: "1 / 1",
};

const photoPosts = posts.filter((p) => isPhotoPost(p));
const videoPosts = posts.filter((p) => isVideoPost(p));

const relationshipTitle =
relationshipTab === "followers"
? "Followers"
: relationshipTab === "following"
? "Following"
: "Friends";

const currentGalleryItem =
gallery && gallery.items.length > 0 ? gallery.items[gallery.index] : null;

const renderMediaGrid = (items: PostRow[], mode: "photos" | "videos") => {
if (items.length === 0) {
return (
<div style={{ opacity: 0.65, fontSize: 13, padding: 8 }}>
{mode === "photos" ? "No photos yet." : "No videos yet."}
</div>
);
}

return (
<div style={mediaGrid}>
{items.map((p) => {
const media = getPostMedia(p);
if (!media) return null;

const groupInfo =
typeof p.group_id === "number" ? groupsById[p.group_id] : null;

return (
<div
key={p.id}
style={mediaTile}
onClick={() => openGalleryForPost(p.id, mode)}
title={p.body || (mode === "photos" ? "Open photo" : "Open video")}
>
{mode === "photos" ? (
// eslint-disable-next-line @next/next/no-img-element
// eslint-disable-next-line @next/next/no-img-element
<img
src={media}
alt=""
draggable={false}
onContextMenu={(e) => e.preventDefault()}
onDragStart={(e) => e.preventDefault()}
style={{
width: "100%",
height: "100%",
objectFit: "contain",
display: "block",
pointerEvents: "none",
userSelect: "none",
WebkitUserSelect: "none",
WebkitTouchCallout: "none",
}}
/>
) : (
<video
src={media}
muted
playsInline
preload="metadata"
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
}}
/>
)}

<div
style={{
position: "absolute",
inset: "auto 0 0 0",
padding: 10,
background:
"linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.00))",
}}
>
<div style={{ fontSize: 12, opacity: 0.86 }}>{timeAgo(p.created_at)}</div>
{groupInfo ? (
<div
style={{
marginTop: 4,
fontSize: 12,
color: "rgba(240,220,255,0.96)",
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
}}
>
Group · {groupInfo.name}
</div>
) : null}
</div>

{mode === "videos" ? (
<div
style={{
position: "absolute",
top: 10,
right: 10,
padding: "5px 8px",
borderRadius: 999,
background: "rgba(0,0,0,0.58)",
border: "1px solid rgba(255,255,255,0.12)",
fontSize: 12,
fontWeight: 800,
}}
>
Video
</div>
) : null}
</div>
);
})}
</div>
);
};

return (
<div style={{ width: "min(920px, 94vw)", margin: "16px auto 0" }}>
<style>{`
@keyframes unboundPop {
@keyframes deleteBounce {
0% { transform: scale(0.86); opacity: 0; }
70% { transform: scale(1.04); opacity: 1; }
100% { transform: scale(1); opacity: 1; }
}
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

{myProfile ? (
<div
style={{
...profileCard,
marginBottom: 18,
}}
>
<div style={{ fontWeight: 900, fontSize: 22, marginBottom: 14 }}>
Profile Details
</div>

<div style={{ display: "grid", gap: 12 }}>
<div>
<div style={{ opacity: 0.58, fontSize: 13, fontWeight: 800 }}>
Relationship Status
</div>
<div>{myProfile.relationship_status || "Not specified"}</div>
</div>

<div>
<div style={{ opacity: 0.58, fontSize: 13, fontWeight: 800 }}>
Orientation
</div>
<div>{myProfile.orientation || "Not specified"}</div>
</div>

<div>
<div style={{ opacity: 0.58, fontSize: 13, fontWeight: 800 }}>
Pronouns
</div>
<div>{myProfile.pronouns || "Not specified"}</div>
</div>

<div>
<div style={{ opacity: 0.58, fontSize: 13, fontWeight: 800 }}>
Looking For
</div>
<div>{myProfile.looking_for || "Not specified"}</div>
</div>

<div>
<div style={{ opacity: 0.58, fontSize: 13, fontWeight: 800 }}>
D/s Relationship
</div>
<div>{myProfile.ds_relationship || "Not specified"}</div>
</div>
</div>

<div
style={{
height: 1,
background: "rgba(255,255,255,0.10)",
margin: "18px 0",
}}
/>

<div style={{ fontWeight: 900, fontSize: 22, marginBottom: 10 }}>
About Me
</div>

<div
style={{
fontSize: 15,
lineHeight: 1.55,
whiteSpace: "pre-wrap",
color: "rgba(255,255,255,0.86)",
}}
>
{myProfile.bio || "You have not added an About Me yet."}
</div>
</div>
) : null}

<div
style={{
display: "flex",
gap: 10,
flexWrap: "wrap",
marginBottom: 16,
}}
>
<button onClick={() => setActiveTab("posts")} style={tabBtn(activeTab === "posts")}>
Posts {posts.length ? `· ${posts.length}` : ""}
</button>

<button
onClick={() => setActiveTab("photos")}
style={tabBtn(activeTab === "photos")}
>
Photos {photoPosts.length ? `· ${photoPosts.length}` : ""}
</button>

<button
onClick={() => setActiveTab("videos")}
style={tabBtn(activeTab === "videos")}
>
Videos {videoPosts.length ? `· ${videoPosts.length}` : ""}
</button>
</div>

{activeTab === "posts" ? (
<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
{posts.map((p) => {

const mediaItems = p.media_items && p.media_items.length > 0 ? p.media_items : [];
const activeIndex = galleryIndex[p.id] ?? 0;
const activeItem = mediaItems[activeIndex] ?? mediaItems[0];

const media =
activeItem?.signed_url ||
activeItem?.media_url ||
p.signed_url ||
getPostMedia(p);

const isVideo = isVideoPost(p);
const isPhoto = isPhotoPost(p);

const spanks = likeCounts[p.id] ?? 0;
const comments = commentCounts[p.id] ?? 0;
const iSpanked = !!likedByMe[p.id];
const myReaction = myReactionByPost[p.id];
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
@{myProfile?.username || "you"}
</div>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
<div style={{ opacity: 0.55, fontSize: 12 }}>
@{myProfile?.username || "you"}
</div>

<button
type="button"
onClick={(e) => {
e.preventDefault();
e.stopPropagation();
setPendingDeletePost(p);
}}
disabled={busyPostId === p.id}
style={{
border: "1px solid rgba(255,120,120,0.35)",
background: "rgba(255,80,80,0.10)",
color: "rgba(255,220,220,0.95)",
borderRadius: 999,
padding: "6px 10px",
cursor: busyPostId === p.id ? "default" : "pointer",
fontWeight: 800,
fontSize: 12,
opacity: busyPostId === p.id ? 0.65 : 1,
}}
title="Delete post"
>
{busyPostId === p.id ? "Deleting..." : "Delete"}
</button>
</div>
</div>

{groupInfo ? (
<div
onClick={() => router.push(`/groups/${groupInfo.slug}`)}
style={{ ...groupPill, cursor: "pointer" }}
>
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
) : (
<div
style={{
width: 18,
height: 18,
borderRadius: 999,
display: "grid",
placeItems: "center",
fontSize: 10,
background: "rgba(255,255,255,0.10)",
border: "1px solid rgba(255,255,255,0.16)",
}}
>
G
</div>
)}

<span>Group · </span>
<span>{groupInfo.name}</span>
</div>
) : null}

{p.body ? (
<div style={{ fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{p.body}
</div>
) : null}

{media && (isPhoto || isVideo) ? (
isVideo ? (
<video
src={media}
controls
style={mediaStyle}
onClick={() => openGalleryForPost(p.id, "videos")}
/>
) : (
<div
style={{
position: "relative",
width: "100%",
marginTop: 12,
}}
>
{mediaItems.length > 1 && (
<>
<button
type="button"
onClick={(e) => {
e.stopPropagation();
setGalleryIndex((prev) => ({
...prev,
[p.id]:
(activeIndex - 1 + mediaItems.length) %
mediaItems.length,
}));
}}
style={{
position: "absolute",
left: 10, // right: 10 on the second button
top: "50%",
transform: "translateY(-50%)",

display: "flex",
alignItems: "center",
justifyContent: "center",
paddingBottom: 5,

zIndex: 5,
width: 42,
height: 42,
borderRadius: "50%",
border: "1px solid rgba(236,72,153,0.55)",
background: "rgba(20,0,28,0.75)",
color: "#ec4899",
fontSize: 26,
fontWeight: 900,
cursor: "pointer",
boxShadow: "0 0 12px rgba(236,72,153,0.35)",
}}
>
‹
</button>

<button
type="button"
onClick={(e) => {
e.stopPropagation();
setGalleryIndex((prev) => ({
...prev,
[p.id]:
(activeIndex + 1) % mediaItems.length,
}));
}}
style={{
position: "absolute",
right: 10, // right: 10 on the second button
top: "50%",
transform: "translateY(-50%)",

display: "flex",
alignItems: "center",
justifyContent: "center",
paddingBottom: 5,
zIndex: 5,
width: 42,
height: 42,
borderRadius: "50%",
border: "1px solid rgba(236,72,153,0.55)",
background: "rgba(20,0,28,0.75)",
color: "#ec4899",
fontSize: 26,
fontWeight: 900,
cursor: "pointer",
boxShadow: "0 0 12px rgba(236,72,153,0.35)",
}}
>
›
</button>
</>
)}

<div
onClick={() => openGalleryForPost(p.id, "photos")}
onContextMenu={(e) => e.preventDefault()}
onDragStart={(e) => e.preventDefault()}
style={{
position: "relative",
width: "100%",
userSelect: "none",
WebkitUserSelect: "none",
WebkitTouchCallout: "none",
cursor: "pointer",
}}
>
<img
src={media}
alt=""
draggable={false}
onContextMenu={(e) => e.preventDefault()}
onDragStart={(e) => e.preventDefault()}
style={{
...mediaStyle,
marginTop: 0,
pointerEvents: "none",
userSelect: "none",
WebkitUserSelect: "none",
WebkitTouchCallout: "none",
}}
/>
</div>
</div>
)
) : null}

<ReactionBar
postId={p.id}
spanks={spanks}
comments={comments}
iSpanked={iSpanked}
myReaction={myReaction}
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
<ReportCommentButton
commentId={c.id}
commentBody={c.body}
commentUserId={c.user_id}
myUserId={myUserId}
onReported={setBanner}
/>
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
) : activeTab === "photos" ? (
renderMediaGrid(photoPosts, "photos")
) : (
renderMediaGrid(videoPosts, "videos")
)}

{relationshipModalOpen ? (
<div
onClick={() => setRelationshipModalOpen(false)}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.72)",
display: "flex",
alignItems: "center",
justifyContent: "center",
zIndex: 9998,
padding: 16,
}}
>
<div
onClick={(e) => e.stopPropagation()}
style={{
width: "min(680px, 96vw)",
maxHeight: "82vh",
overflow: "auto",
background: "rgba(0,0,0,0.88)",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 16,
padding: 14,
}}
>
<div
style={{
display: "flex",
gap: 10,
flexWrap: "wrap",
marginBottom: 14,
}}
>
<button
onClick={() => {
if (!myUserId) return;
setRelationshipTab("followers");
void loadRelationshipProfiles(myUserId, "followers");
}}
style={tabBtn(relationshipTab === "followers")}
>
Followers
</button>

<button
onClick={() => {
if (!myUserId) return;
setRelationshipTab("following");
void loadRelationshipProfiles(myUserId, "following");
}}
style={tabBtn(relationshipTab === "following")}
>
Following
</button>

<button
onClick={() => {
if (!myUserId) return;
setRelationshipTab("friends");
void loadRelationshipProfiles(myUserId, "friends");
}}
style={tabBtn(relationshipTab === "friends")}
>
Friends
</button>

<div style={{ flex: 1 }} />

<button onClick={() => setRelationshipModalOpen(false)} style={pillBtn}>
Close
</button>
</div>

<div style={{ fontSize: 22, fontWeight: 850, marginBottom: 12 }}>
{relationshipTitle}
</div>

{relationshipLoading ? (
<div style={{ opacity: 0.72 }}>Loading…</div>
) : relationshipProfiles.length === 0 ? (
<div style={{ opacity: 0.72 }}>No {relationshipTitle.toLowerCase()} yet.</div>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{relationshipProfiles.map((p) => (
<Link
key={p.id}

href={`/u/${p.username || p.id}`}
onClick={(e) => {
e.stopPropagation();
setRelationshipModalOpen(false);
}}
style={{
display: "flex",
alignItems: "center",
gap: 12,
padding: 12,
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.10)",
background: "rgba(0,0,0,0.18)",
textDecoration: "none",
color: "white",
}}
>
{p.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={p.avatar_url}
alt=""
style={{
width: 46,
height: 46,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.16)",
}}
/>
) : (
<div
style={{
width: 46,
height: 46,
borderRadius: 999,
display: "grid",
placeItems: "center",
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(255,255,255,0.04)",
fontWeight: 800,
opacity: 0.75,
}}
>
{(p.display_name || p.username || "?").charAt(0).toUpperCase()}
</div>
)}

<div style={{ minWidth: 0, flex: 1 }}>
<div style={{ fontWeight: 800 }}>
{p.display_name || p.username || "Unknown"}
</div>
{p.username ? (
<div style={{ opacity: 0.72, fontSize: 13 }}>@{p.username}</div>
) : null}
</div>

<div style={{ opacity: 0.62, fontSize: 13 }}>View →</div>
</Link>
))}
</div>
)}
</div>
</div>
) : null}

{gallery && currentGalleryItem ? (
<div
onClick={() => setGallery(null)}
style={{
position: "fixed",
top: 90,
left: 0,
right: 0,
bottom: 0,
background: "rgba(0,0,0,0.82)",
display: "flex",
alignItems: "flex-start",
justifyContent: "center",
zIndex: 99999,
padding: "20px 16px 40px",
overflowY: "auto",
}}
>
<div
onClick={(e) => e.stopPropagation()}
style={{
width: "min(1040px, 96vw)",
background: "rgba(0,0,0,0.90)",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 16,
padding: 12,
marginBottom: 40,
}}
>
<div
style={{
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 10,
marginBottom: 10,
}}
>
<div style={{ fontSize: 13, opacity: 0.8 }}>
{gallery.index + 1} of {gallery.items.length}
</div>

<div style={{ display: "flex", gap: 8 }}>
<button
onClick={galleryPrev}
disabled={gallery.items.length <= 1}
style={{
...pillBtn,
opacity: gallery.items.length <= 1 ? 0.5 : 1,
}}
>
← Prev
</button>

<button
onClick={galleryNext}
disabled={gallery.items.length <= 1}
style={{
...pillBtn,
opacity: gallery.items.length <= 1 ? 0.5 : 1,
}}
>
Next →
</button>

<button onClick={() => setGallery(null)} style={pillBtn}>
Close
</button>
</div>
</div>
{currentGalleryItem.type === "image" ? (
<div
onContextMenu={(e) => e.preventDefault()}
onDragStart={(e) => e.preventDefault()}
style={{
position: "relative",
width: "100%",
userSelect: "none",
WebkitUserSelect: "none",
WebkitTouchCallout: "none",
}}
>

{/* eslint-disable-next-line @next/next/no-img-element */}
<img
src={currentGalleryItem.url}
alt=""
draggable={false}
onContextMenu={(e) => e.preventDefault()}
onDragStart={(e) => e.preventDefault()}
style={{
width: "100%",
borderRadius: 12,
maxHeight: "58vh",
objectFit: "contain",
display: "block",
margin: "0 auto",
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
borderRadius: 12,
background: "transparent",
}}
/>
</div>
) : (
<video
src={currentGalleryItem.url}
controls
autoPlay
style={{
width: "100%",
borderRadius: 12,
maxHeight: "58vh",
background: "black",
display: "block",
margin: "0 auto",
}}
/>
)}

<div style={{ marginTop: 10 }}>
<div style={{ fontSize: 13, opacity: 0.72 }}>
{timeAgo(currentGalleryItem.createdAt)}
</div>

{currentGalleryItem.caption ? (
<div
style={{
marginTop: 6,
whiteSpace: "pre-wrap",
lineHeight: 1.45,
}}
>
{currentGalleryItem.caption}
</div>
) : null}
</div>
</div>
</div>
) : null}
{pendingDeletePost ? (
<div
onClick={() => setPendingDeletePost(null)}
style={{
position: "fixed",
inset: 0,
zIndex: 10000,
background: "rgba(0,0,0,0.76)",
backdropFilter: "blur(10px)",
display: "flex",
alignItems: "center",
justifyContent: "center",
padding: 18,
}}
>
<div
onClick={(e) => e.stopPropagation()}
style={{
width: "min(420px, 94vw)",
borderRadius: 22,
padding: 20,
background:
"linear-gradient(180deg, rgba(35,0,48,0.96), rgba(0,0,0,0.94))",
border: "1px solid rgba(236,72,153,0.55)",
boxShadow:
"0 0 30px rgba(236,72,153,0.35), 0 0 70px rgba(168,85,247,0.25)",
color: "white",
transform: "scale(1)",
animation: "deleteBounce 0.22s ease-out",
}}
>
<div
style={{
fontSize: 24,
fontWeight: 900,
marginBottom: 8,
color: "rgba(255,230,250,0.98)",
}}
>
Delete this post?
</div>

<div
style={{
opacity: 0.72,
fontSize: 14,
lineHeight: 1.45,
marginBottom: 18,
}}
>
This will permanently remove it from your profile and feed.
</div>

<div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
<button
type="button"
onClick={() => setPendingDeletePost(null)}
style={{
padding: "10px 16px",
borderRadius: 999,
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(255,255,255,0.08)",
color: "white",
cursor: "pointer",
fontWeight: 800,
}}
>
Cancel
</button>

<button
type="button"
onClick={async () => {
const post = pendingDeletePost;
setPendingDeletePost(null);
if (post) await deletePost(post);
}}
style={{
padding: "10px 16px",
borderRadius: 999,
border: "1px solid rgba(255,120,120,0.45)",
background: "linear-gradient(90deg,#dc2626,#ec4899)",
color: "white",
cursor: "pointer",
fontWeight: 900,
boxShadow: "0 0 16px rgba(236,72,153,0.45)",
}}
>
Delete
</button>
</div>
</div>
</div>
) : null}
</div>
);
}