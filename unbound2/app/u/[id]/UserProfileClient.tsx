"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import PublicProfileActions from "./PublicProfileActions";
import ReactionBar from "@/app/components/ReactionBar";

type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";
type ReactionCountsMap = Partial<Record<ReactionKey, number>>;
type ProfileTab = "posts" | "photos" | "videos";
type RelationshipTab = "followers" | "following" | "friends";
type SignalType = "interested" | "curious" | "would" | "crush";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
bio: string | null;
avatar_url: string | null;
buy_me_a_coffee_url?: string | null;
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

type GalleryItem = {
postId: number;
url: string;
type: "image" | "video";
caption: string | null;
createdAt: string;
};

type UserKinkRow = {
id: string;
user_id: string;
kink: string;
interest: "into" | "curious" | "limit";
role: "giving" | "receiving" | "both" | "watching";
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

export default function UserProfileClient({ profile }: { profile: ProfileRow }) {
const supabase = useMemo(() => getSupabase(), []);

const [myUserId, setMyUserId] = useState<string | null>(null);
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

const [signalLoading, setSignalLoading] = useState(false);
const [mySignalToProfile, setMySignalToProfile] = useState<SignalType | null>(null);
const [signalBanner, setSignalBanner] = useState<string | null>(null);
const [profileKinks, setProfileKinks] = useState<UserKinkRow[]>([]);

const [kinksModalOpen, setKinksModalOpen] = useState(false);
async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadProfileKinks(targetUserId: string) {
const { data, error } = await supabase
.from("user_kinks")
.select("id,user_id,kink,interest,role,created_at")
.eq("user_id", targetUserId)
.order("created_at", { ascending: false });

if (error) {
console.error("loadProfileKinks error:", error.message);
setProfileKinks([]);
return;
}

setProfileKinks((data ?? []) as UserKinkRow[]);
}

async function loadMySignal(targetUserId: string, viewerId: string | null) {
if (!viewerId || viewerId === targetUserId) {
setMySignalToProfile(null);
return;
}

const { data, error } = await supabase
.from("user_signals")
.select("signal_type")
.eq("sender_id", viewerId)
.eq("receiver_id", targetUserId)
.maybeSingle();

if (error) return;

setMySignalToProfile((data?.signal_type as SignalType | undefined) ?? null);
}

async function sendSignal(type: SignalType) {
const uid = myUserId ?? (await refreshAuth());

if (!uid) {
setBanner("You need to be signed in to send a signal.");
return;
}

if (uid === profile.id) {
setBanner("You can't send a signal to yourself.");
return;
}

setSignalLoading(true);
setSignalBanner(null);
setBanner(null);

const { error: upsertError } = await supabase.from("user_signals").upsert(
{
sender_id: uid,
receiver_id: profile.id,
signal_type: type,
},
{
onConflict: "sender_id,receiver_id",
}
);

if (upsertError) {
setBanner(upsertError.message);
setSignalLoading(false);
return;
}

setMySignalToProfile(type);

const { data: reverse, error: reverseError } = await supabase
.from("user_signals")
.select("id, signal_type")
.eq("sender_id", profile.id)
.eq("receiver_id", uid)
.maybeSingle();

if (reverseError) {
setBanner(reverseError.message);
setSignalLoading(false);
return;
}

if (reverse) {
setSignalBanner("🔥 It's mutual!");
} else {
setSignalBanner("Signal sent.");
}

setSignalLoading(false);
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

async function loadRelationshipCounts(targetUserId: string) {
try {
const [
followersRes,
followingRes,
friendsLeftRes,
friendsRightRes,
] = await Promise.all([
supabase
.from("follows")
.select("follower_id", { count: "exact" })
.eq("following_id", targetUserId),
supabase
.from("follows")
.select("following_id", { count: "exact" })
.eq("follower_id", targetUserId),
supabase
.from("friends")
.select("friend_id")
.eq("user_id", targetUserId),
supabase
.from("friends")
.select("user_id")
.eq("friend_id", targetUserId),
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
// keep quiet for now
}
}

async function loadRelationshipProfiles(
targetUserId: string,
mode: RelationshipTab
) {
setRelationshipLoading(true);
try {
let ids: string[] = [];

if (mode === "followers") {
const { data, error } = await supabase
.from("follows")
.select("follower_id")
.eq("following_id", targetUserId);

if (error) throw error;
ids = Array.from(
new Set((data ?? []).map((r: any) => String(r.follower_id)).filter(Boolean))
);
} else if (mode === "following") {
const { data, error } = await supabase
.from("follows")
.select("following_id")
.eq("follower_id", targetUserId);

if (error) throw error;
ids = Array.from(
new Set((data ?? []).map((r: any) => String(r.following_id)).filter(Boolean))
);
} else {
const [left, right] = await Promise.all([
supabase.from("friends").select("friend_id").eq("user_id", targetUserId),
supabase.from("friends").select("user_id").eq("friend_id", targetUserId),
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
setRelationshipTab(mode);
setRelationshipModalOpen(true);
await loadRelationshipProfiles(profile.id, mode);
}

async function loadProfilePosts(targetUserId: string, viewerId: string | null) {
setBanner(null);

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type,group_id")
.eq("user_id", targetUserId)
.order("created_at", { ascending: false })
.limit(100);

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
await Promise.all([
loadProfilePosts(profile.id, uid),
loadRelationshipCounts(profile.id),
loadMySignal(profile.id, uid),
loadProfileKinks(profile.id),
]);
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

const countPill: React.CSSProperties = {
padding: "8px 14px",
borderRadius: 999,
border: "2px solid rgba(236,72,153,0.85)", // thicker + brighter
background: "rgba(236, 72, 154, 0.17)",
cursor: "pointer",
color: "white",
fontWeight: 700,
boxShadow:
"0 0 10px rgba(236,72,153,0.25), 0 0 20px rgba(192,38,211,0.18)",
};


const tabBtn = (active: boolean): React.CSSProperties => ({
padding: "9px 16px",
borderRadius: 999,
border: active
? "1px solid rgba(236,72,153,0.95)"
: "1px solid rgba(180,120,255,0.25)",

background: active
? "linear-gradient(180deg, rgba(240, 32, 139, 0.95), rgba(192,38,211,0.85))"
: "rgba(0,0,0,0.35)",

color: "white",
cursor: "pointer",
fontWeight: 800,

boxShadow: active
? "0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)"
: undefined,
});



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

const mediaGrid: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
gap: 14,
};

const mediaTile: React.CSSProperties = {
position: "relative",
borderRadius: 16,
overflow: "hidden",
border: "2px solid rgba(236,72,153,0.35)",
background: "rgba(20,0,20,0.55)",
cursor: "pointer",
aspectRatio: "1 / 1",
transition: "all 0.18s ease",
boxShadow: "0 0 18px rgba(192,38,211,0.22)",
};

const photoPosts = posts.filter((p) => isPhotoPost(p));
const videoPosts = posts.filter((p) => isVideoPost(p));

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
const items = makeGalleryItems(mode === "photos" ? photoPosts : videoPosts, mode);
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
onMouseEnter={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(-10px) scale(1.04)";
el.style.borderColor = "rgba(236,72,153,0.95)";
el.style.boxShadow =
"0 24px 50px rgba(0,0,0,0.45), 0 0 22px rgba(236,72,153,0.55), 0 0 55px rgba(192,38,211,0.55), 0 0 90px rgba(168,85,247,0.30)";
}}
onMouseLeave={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(0) scale(1)";
el.style.borderColor = "rgba(236,72,153,0.35)";
el.style.boxShadow = "0 0 18px rgba(192,38,211,0.22)";
}}
title={p.body || (mode === "photos" ? "Open photo" : "Open video")}
>
{mode === "photos" ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={media}
alt=""
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
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
<div style={{ fontSize: 12, opacity: 0.86 }}>
{timeAgo(p.created_at)}
</div>

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

const relationshipTitle =
relationshipTab === "followers"
? "Followers"
: relationshipTab === "following"
? "Following"
: "Friends";

const currentGalleryItem =
gallery && gallery.items.length > 0 ? gallery.items[gallery.index] : null;

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

{signalBanner ? (
<div style={{ marginBottom: 12, color: "hotpink" }}>
{signalBanner}
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

<div
style={{
display: "flex",
gap: 10,
flexWrap: "wrap",
marginTop: 14,
}}
>
<button
onClick={() => openRelationshipModal("followers")}
style={countPill}
>
Followers · {relationshipCounts.followers}
</button>

<button
onClick={() => openRelationshipModal("following")}
style={countPill}
>
Following · {relationshipCounts.following}
</button>

<button
onClick={() => openRelationshipModal("friends")}
style={countPill}
>
Friends · {relationshipCounts.friends}
</button>
</div>

<div style={{ marginTop: 14 }}>
<PublicProfileActions
targetProfileId={profile.id}
buyMeACoffeeUrl={profile.buy_me_a_coffee_url ?? null}
/>
</div>
{myUserId !== profile.id ? (
<div style={{ marginTop: 14 }}>
<div
style={{
fontSize: 12,
fontWeight: 800,
opacity: 0.78,
marginBottom: 8,
textTransform: "uppercase",
letterSpacing: 0.4,
}}
>
Send a signal
</div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button
onClick={() => sendSignal("interested")}
disabled={signalLoading}
style={{
padding: "10px 14px",
borderRadius: 999,
border:
mySignalToProfile === "interested"
? "1px solid rgba(236,72,153,0.95)"
: "1px solid rgba(180,120,255,0.25)",
background:
mySignalToProfile === "interested"
? "linear-gradient(180deg, rgba(240,32,139,0.95), rgba(192,38,211,0.85))"
: "rgba(0,0,0,0.35)",
color: "white",
cursor: signalLoading ? "default" : "pointer",
fontWeight: 800,
opacity: signalLoading ? 0.6 : 1,
boxShadow:
mySignalToProfile === "interested"
? "0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)"
: undefined,
}}
>
💜 Interested
</button>

<button
onClick={() => sendSignal("curious")}
disabled={signalLoading}
style={{
padding: "10px 14px",
borderRadius: 999,
border:
mySignalToProfile === "curious"
? "1px solid rgba(236,72,153,0.95)"
: "1px solid rgba(180,120,255,0.25)",
background:
mySignalToProfile === "curious"
? "linear-gradient(180deg, rgba(240,32,139,0.95), rgba(192,38,211,0.85))"
: "rgba(0,0,0,0.35)",
color: "white",
cursor: signalLoading ? "default" : "pointer",
fontWeight: 800,
opacity: signalLoading ? 0.6 : 1,
boxShadow:
mySignalToProfile === "curious"
? "0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)"
: undefined,
}}
>
👀 Curious
</button>

<button
onClick={() => sendSignal("would")}
disabled={signalLoading}
style={{
padding: "10px 14px",
borderRadius: 999,
border:
mySignalToProfile === "would"
? "1px solid rgba(236,72,153,0.95)"
: "1px solid rgba(180,120,255,0.25)",
background:
mySignalToProfile === "would"
? "linear-gradient(180deg, rgba(240,32,139,0.95), rgba(192,38,211,0.85))"
: "rgba(0,0,0,0.35)",
color: "white",
cursor: signalLoading ? "default" : "pointer",
fontWeight: 800,
opacity: signalLoading ? 0.6 : 1,
boxShadow:
mySignalToProfile === "would"
? "0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)"
: undefined,
}}
>
🔥 Would
</button>

<button
onClick={() => sendSignal("crush")}
disabled={signalLoading}
style={{
padding: "10px 14px",
borderRadius: 999,
border:
mySignalToProfile === "crush"
? "1px solid rgba(236,72,153,0.95)"
: "1px solid rgba(180,120,255,0.25)",
background:
mySignalToProfile === "crush"
? "linear-gradient(180deg, rgba(240,32,139,0.95), rgba(192,38,211,0.85))"
: "rgba(0,0,0,0.35)",
color: "white",
cursor: signalLoading ? "default" : "pointer",
fontWeight: 800,
opacity: signalLoading ? 0.6 : 1,
boxShadow:
mySignalToProfile === "crush"
? "0 0 18px rgba(236,72,153,0.45), 0 0 35px rgba(192,38,211,0.35)"
: undefined,
}}
>
😈 Crush
</button>
</div>
</div>
) : null}
</div>
</div>
</div>

{profileKinks.length > 0 ? (
<div
style={{
marginTop: 16,
padding: 14,
borderRadius: 14,
border: "1px solid rgba(236,72,153,0.35)",
background: "rgba(0,0,0,0.35)",
boxShadow: "0 0 14px rgba(236,72,153,0.12)",
display: "flex",
justifyContent: "space-between",
alignItems: "center",
}}
>
<div>
<div style={{ fontWeight: 900, fontSize: 18 }}>
Kinks & Interests
</div>
<div style={{ opacity: 0.7, fontSize: 13 }}>
{profileKinks.length} saved
</div>
</div>

<button
onClick={() => setKinksModalOpen(true)}
style={pillBtn}
>
View
</button>
</div>
) : null}
<div
style={{
display: "flex",
gap: 10,
flexWrap: "wrap",
marginTop: 12,
marginBottom: 18,
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
const media = getPostMedia(p);

const isVideo = isVideoPost(p);
const isPhoto = isPhotoPost(p);

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
<video
src={media}
controls
style={mediaStyle}
onClick={() => openGalleryForPost(p.id, "videos")}
/>
) : (
// eslint-disable-next-line @next/next/no-img-element
<img
src={media}
alt=""
style={{ ...mediaStyle, cursor: "pointer" }}
onClick={() => openGalleryForPost(p.id, "photos")}
/>
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
) : activeTab === "photos" ? (
renderMediaGrid(photoPosts, "photos")
) : (
renderMediaGrid(videoPosts, "videos")
)}


{kinksModalOpen ? (
<div
onClick={() => setKinksModalOpen(false)}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.74)",
backdropFilter: "blur(14px)",
WebkitBackdropFilter: "blur(14px)",
display: "flex",
alignItems: "center",
justifyContent: "center",
zIndex: 9999,
padding: 16,
}}
>
<div
onClick={(e) => e.stopPropagation()}
style={{
width: "min(620px, 96vw)",
maxHeight: "82vh",
overflowY: "auto",
borderRadius: 22,
padding: 18,
background:
"linear-gradient(180deg, rgba(20,0,28,0.96), rgba(0,0,0,0.94))",
border: "1px solid rgba(236,72,153,0.55)",
boxShadow:
"0 0 25px rgba(236,72,153,0.26), 0 0 55px rgba(168,85,247,0.18)",
color: "white",
}}
>
<div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
<div>
<div style={{ fontSize: 24, fontWeight: 900 }}>
Kinks & Interests
</div>
<div style={{ opacity: 0.72, fontSize: 13, marginTop: 4 }}>
Private view — profile content is blurred behind this.
</div>
</div>

<button
type="button"
onClick={() => setKinksModalOpen(false)}
style={pillBtn}
>
Close
</button>
</div>

<div style={{ marginTop: 18 }}>
{(["into", "curious", "limit"] as const).map((section) => {
const rows = profileKinks.filter((k) => k.interest === section);
if (rows.length === 0) return null;

return (
<div key={section} style={{ marginBottom: 18 }}>
<div style={{ fontWeight: 900, marginBottom: 8 }}>
{section === "into"
? "Into"
: section === "curious"
? "Curious About"
: "Limits"}
</div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
{rows.map((k) => (
<div
key={k.id}
style={{
padding: "8px 10px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(168,85,247,0.12)",
boxShadow: "0 0 10px rgba(168,85,247,0.16)",
fontSize: 13,
fontWeight: 750,
}}
>
{k.kink} <span style={{ opacity: 0.62 }}>({k.role})</span>
</div>
))}
</div>
</div>
);
})}
</div>
</div>
</div>
) : null}

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
setRelationshipTab("followers");
void loadRelationshipProfiles(profile.id, "followers");
}}
style={tabBtn(relationshipTab === "followers")}
>
Followers
</button>

<button
onClick={() => {
setRelationshipTab("following");
void loadRelationshipProfiles(profile.id, "following");
}}
style={tabBtn(relationshipTab === "following")}
>
Following
</button>

<button
onClick={() => {
setRelationshipTab("friends");
void loadRelationshipProfiles(profile.id, "friends");
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
href={`/u/${p.id}`}
onClick={() => setRelationshipModalOpen(false)}
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
inset: 0,
background: "rgba(0,0,0,0.82)",
display: "flex",
alignItems: "flex-start",
justifyContent: "center",
zIndex: 9999,
paddingTop: 80,
paddingRight: 16,
paddingBottom: 16,
paddingLeft: 16,
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
// eslint-disable-next-line @next/next/no-img-element
<img
src={currentGalleryItem.url}
alt=""
style={{
width: "100%",
borderRadius: 12,
maxHeight: "76vh",
objectFit: "contain",
}}
/>
) : (
<video
src={currentGalleryItem.url}
controls
autoPlay
style={{
width: "100%",
borderRadius: 12,
maxHeight: "76vh",
background: "black",
}}
/>
)}

<div style={{ marginTop: 10 }}>
<div style={{ fontSize: 13, opacity: 0.72 }}>
{timeAgo(currentGalleryItem.createdAt)}
</div>
{currentGalleryItem.caption ? (
<div style={{ marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
{currentGalleryItem.caption}
</div>
) : null}
</div>
</div>
</div>
) : null}
</div>
);
}