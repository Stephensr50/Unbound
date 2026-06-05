"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PublicProfileActions from "./PublicProfileActions";
import ReactionBar from "../../components/ReactionBar";
import ReportCommentButton from "../../components/ReportCommentButton";
import ReportPostButton from "../../components/ReportPostButton";

type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";
type ReactionCountsMap = Partial<Record<ReactionKey, number>>;
type ProfileTab = "posts" | "photos" | "videos";
type RelationshipTab = "followers" | "following" | "friends";
type SignalType = "interested" | "curious" | "would" | "crush";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
designation?: string | null;
founder_badge?: string | null;
bio: string | null;
avatar_url: string | null;
buy_me_a_coffee_url?: string | null;
city?: string | null;
state?: string | null;
country?: string | null;
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
is_locked: boolean | null;
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
const router = useRouter();
const searchParams = useSearchParams();



const [myUserId, setMyUserId] = useState<string | null>(null);
const [posts, setPosts] = useState<PostRow[]>([]);
const [banner, setBanner] = useState<string | null>(null);
const [openPostMenu, setOpenPostMenu] = useState<Record<number, boolean>>({});
const [profileUnavailable, setProfileUnavailable] = useState(false);
const [checkingBlock, setCheckingBlock] = useState(true);
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

const [unlockedPostIds, setUnlockedPostIds] = useState<Record<number, boolean>>({});

const [signalLoading, setSignalLoading] = useState(false);
const [mySignalToProfile, setMySignalToProfile] = useState<SignalType | null>(null);
const [signalBanner, setSignalBanner] = useState<string | null>(null);
const [profileKinks, setProfileKinks] = useState<UserKinkRow[]>([]);

const [kinksModalOpen, setKinksModalOpen] = useState(false);
const [aboutModalOpen, setAboutModalOpen] = useState(false);
async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function checkProfileBlockStatus(viewerId: string | null) {
if (!viewerId || viewerId === profile.id) {
setProfileUnavailable(false);
setCheckingBlock(false);
return;
}

setCheckingBlock(true);

try {
const { data, error } = await supabase
.from("blocked_users")
.select("id")
.or(
`and(blocker_id.eq.${viewerId},blocked_id.eq.${profile.id}),and(blocker_id.eq.${profile.id},blocked_id.eq.${viewerId})`
)
.limit(1);

if (error) throw error;

setProfileUnavailable((data ?? []).length > 0);
} catch {
setProfileUnavailable(false);
} finally {
setCheckingBlock(false);
}
}

useEffect(() => {
void (async () => {
const uid = await refreshAuth();
await checkProfileBlockStatus(uid);
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [profile.id]);
useEffect(() => {
void (async () => {
const sessionId = searchParams.get("checkout_session_id");

if (!sessionId) return;

setBanner("Confirming payment...");

const res = await fetch("/api/unlocks/confirm", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({ sessionId }),
});

const data = await res.json();

if (!res.ok) {
setBanner(data?.error || "Could not confirm payment.");
return;
}

window.location.reload();


})();

// eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchParams]);
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

async function openMessageWithProfile() {
const uid = myUserId ?? (await refreshAuth());

if (!uid) {
setBanner("You need to be signed in to message.");
return;
}

const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData.session?.access_token;

if (!token) {
setBanner("You need to be signed in to message.");
return;
}

const res = await fetch("/api/conversations/get-or-create", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${token}`,
},
body: JSON.stringify({
to: profile.id,
}),
});

const json = await res.json();

if (!res.ok) {
setBanner(json?.error || "Could not open messages.");
return;
}

const conversationId = json.conversationId ?? json.conversation_id ?? json.id;

if (!conversationId) {
console.log("get-or-create response:", json);
setBanner("Could not open messages: missing conversation id.");
return;
}

router.push(`/messages/${conversationId}`);
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
.select("id,user_id,body,kind,created_at,media_url,media_type,group_id,is_locked")
.eq("user_id", targetUserId)
.order("created_at", { ascending: false })
.limit(100);

if (error) {
setBanner(error.message);
setPosts([]);
return;
}

const rows = (data ?? []) as PostRow[];
let unlockedMap: Record<number, boolean> = {};

if (viewerId) {
const lockedPostIds = rows
.filter((p) => p.is_locked)
.map((p) => p.id);

if (lockedPostIds.length) {
const { data: unlockRows } = await supabase
.from("post_unlocks")
.select("post_id")
.eq("buyer_id", viewerId)
.in("post_id", lockedPostIds);

unlockedMap = Object.fromEntries(
(unlockRows ?? []).map((r: any) => [
Number(r.post_id),
true,
])
);
}
}

setUnlockedPostIds(unlockedMap);
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
let cancelled = false;
let channel: ReturnType<typeof supabase.channel> | null = null;

(async () => {
const uid = await refreshAuth();

await Promise.all([
loadProfilePosts(profile.id, uid),
loadRelationshipCounts(profile.id),
loadMySignal(profile.id, uid),
loadProfileKinks(profile.id),
]);

if (cancelled || !uid) return;

const channelName = `user-signals-profile-${profile.id}-${uid}-${Date.now()}-${Math.random()}`;

channel = supabase
.channel(channelName)
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "user_signals",
},
async (payload) => {
const row = payload.new as any;

const affectsThisProfile =
row?.sender_id === profile.id ||
row?.receiver_id === profile.id ||
row?.sender_id === uid ||
row?.receiver_id === uid;

if (!affectsThisProfile) return;

await loadMySignal(profile.id, uid);

const { data: reverse } = await supabase
.from("user_signals")
.select("id, signal_type")
.eq("sender_id", profile.id)
.eq("receiver_id", uid)
.maybeSingle();

const { data: mine } = await supabase
.from("user_signals")
.select("id, signal_type")
.eq("sender_id", uid)
.eq("receiver_id", profile.id)
.maybeSingle();

if (reverse && mine) {
setSignalBanner("🔥 It's mutual!");
}
}
)
.subscribe();
})();

return () => {
cancelled = true;

if (channel) {
supabase.removeChannel(channel);
}
};

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

async function unlockPost(post: PostRow) {
const uid = myUserId ?? (await refreshAuth());

if (!uid) {
setBanner("You need to be signed in to unlock this post.");
return;
}

const res = await fetch("/api/checkout", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
postId: post.id,
userId: uid,
returnTo: `/u/${profile.id}?post=${post.id}`,
}),
});

const data = await res.json();

if (!res.ok) {
setBanner(data.error || "Unable to start checkout.");
return;
}

if (!data.url) {
setBanner("Checkout did not return a payment link.");
return;
}

window.location.href = data.url;
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
objectFit: "contain",
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


if (checkingBlock) {
return (
<div style={{ width: "min(920px, 94vw)", margin: "30px auto", color: "white" }}>
<h1 style={{ fontSize: 34, marginBottom: 10 }}>Loading profile…</h1>
</div>
);
}

if (profileUnavailable) {
return (
<div style={{ width: "min(920px, 94vw)", margin: "30px auto", color: "white" }}>
<h1 style={{ fontSize: 34, marginBottom: 10 }}>Profile unavailable.</h1>
<div style={{ opacity: 0.85 }}>
This profile is not available.
</div>
</div>
);
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
onClick={() => {
if (p.is_locked && !unlockedPostIds[p.id]) {
void unlockPost(p);
return;
}

openGalleryForPost(p.id, mode);
}}
onMouseEnter={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(-10px) scale(1.04)";
el.style.borderColor = "rgba(236,72,153,0.95)";
el.style.boxShadow =
"0 24px 50px rgba(0,0,0,0.45), 0 0 22px rgba(236,72,153,0.55), 0 0 55px rgba(192,38,211,0.55)";
}}
onMouseLeave={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(0) scale(1)";
el.style.borderColor = "rgba(236,72,153,0.35)";
el.style.boxShadow = "0 0 18px rgba(192,38,211,0.22)";
}}
title={p.body || (mode === "photos" ? "Open photo" : "Open video")}
>
{p.is_locked ? (
<div
style={{
width: "100%",
height: "100%",
display: "flex",
alignItems: "center",
justifyContent: "center",
flexDirection: "column",
gap: 8,
background:
"linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.82))",
backdropFilter: "blur(18px)",
WebkitBackdropFilter: "blur(18px)",
color: "white",
textAlign: "center",
padding: 14,
boxShadow:
"inset 0 0 24px rgba(236,72,153,0.16), 0 0 22px rgba(168,85,247,0.16)",
}}
>
<div
style={{
width: 58,
height: 58,
borderRadius: "50%",
display: "flex",
alignItems: "center",
justifyContent: "center",
background: "rgba(255,255,255,0.08)",
border: "1px solid rgba(255,255,255,0.12)",
boxShadow:
"0 0 18px rgba(236,72,153,0.32), 0 0 38px rgba(168,85,247,0.22)",
marginBottom: 4,
}}
>
<div style={{ fontSize: 30 }}>🔒</div>
</div>

<div style={{ fontWeight: 900 }}>Locked</div>
<div style={{ fontSize: 12, opacity: 0.78 }}>$1.49 unlock</div>
</div>
) : mode === "photos" ? (
<img
src={media}
alt=""
style={{
width: "100%",
height: "100%",
objectFit: "contain",
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
objectFit: "contain",
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

{mode === "videos" && !p.is_locked ? (
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
<div
onClick={openMessageWithProfile}
title="Open messages"
style={{
marginBottom: 16,
padding: "12px 18px",
borderRadius: 14,
background: "linear-gradient(90deg,#ec4899,#c026d3)",
color: "white",
fontWeight: 900,
textAlign: "center",
cursor: "pointer",
boxShadow:
"0 0 18px rgba(236,72,153,0.45), 0 0 40px rgba(192,38,211,0.35)",
animation: "unboundPop 0.35s ease",
}}
>
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
borderRadius: "50%",
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

{profile.designation ? (
<div style={{ opacity: 0.9, marginTop: 4, fontWeight: 750 }}>
{profile.designation}
</div>
) : null}

{profile.founder_badge === "founding_member_001" ? (
<div
style={{
display: "inline-flex",
alignItems: "center",
gap: 8,
marginTop: 10,
padding: "8px 13px",
borderRadius: 999,
background:
"linear-gradient(135deg, rgba(168,85,247,0.30), rgba(236,72,153,0.24))",
border: "1px solid rgba(255,215,0,0.65)",
boxShadow:
"0 0 18px rgba(255,215,0,0.35), 0 0 32px rgba(168,85,247,0.35)",
color: "rgba(255,245,255,0.96)",
fontWeight: 900,
fontSize: 13,
}}
>
<div
style={{
display: "flex",
flexDirection: "column",
alignItems: "center",
gap: 2,
}}
>
<div>⭐ 💜 Founding Member #001 ⭐</div>

<div
style={{
fontSize: 11,
fontWeight: 700,
color: "rgba(255,220,120,0.88)",
letterSpacing: "0.04em",
textTransform: "uppercase",
}}
>
First Official Member of Unbound
</div>
</div>
</div>
) : null}

{[profile.city, profile.state, profile.country].filter(Boolean).length > 0 ? (
<div style={{ opacity: 0.85, marginTop: 6 }}>
{[profile.city, profile.state, profile.country].filter(Boolean).join(", ")}
</div>
) : profile.location ? (
<div style={{ opacity: 0.85, marginTop: 6 }}>{profile.location}</div>
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
{profile.bio ? (
<button
type="button"
onClick={() => setAboutModalOpen(true)}
style={{
...pillBtn,
marginTop: 12,
border: "1px solid rgba(236,72,153,0.45)",
boxShadow: "0 0 14px rgba(236,72,153,0.22)",
}}
>
About Me
</button>
) : null}
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
const isMine = p.user_id === myUserId;
const media = getPostMedia(p);

const isVideo = isVideoPost(p);
const isPhoto = isPhotoPost(p);

const isBusy = busyPostId === p.id;
const isOpen = !!openComments[p.id];
const groupInfo =
typeof p.group_id === "number" ? groupsById[p.group_id] : null;

return (
<div key={p.id} style={{ ...card, position: "relative" }}>
<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingRight: 52 }}>
{profile.avatar_url ? (
<img src={profile.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: 999, objectFit: "cover", border: "1px solid rgba(180,120,255,0.24)", flex: "0 0 auto" }} />
) : (
<div style={{ width: 48, height: 48, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(168,85,247,0.18)", border: "1px solid rgba(180,120,255,0.24)", fontWeight: 900, flex: "0 0 auto" }}>
{(profile.display_name || profile.username || "U").charAt(0).toUpperCase()}
</div>
)}

<div style={{ minWidth: 0 }}>
<div style={{ fontWeight: 850, fontSize: 16 }}>
{profile.display_name || profile.username || "Unknown"}
</div>
<div style={{ opacity: 0.65, fontSize: 12 }}>
{profile.username ? `@${profile.username} · ` : ""}
{timeAgo(p.created_at)}
</div>
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
objectFit: "contain",
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
false ? (
<div
onClick={() => unlockPost(p)}
onMouseEnter={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(-4px) scale(1.01)";
el.style.boxShadow =
"0 0 35px rgba(236,72,153,0.32), 0 0 80px rgba(168,85,247,0.22)";
}}
onMouseLeave={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(0) scale(1)";
el.style.boxShadow =
"0 0 25px rgba(236,72,153,0.18), 0 0 60px rgba(168,85,247,0.12)";
}}
style={{
...mediaStyle,
minHeight: 420,
display: "flex",
alignItems: "center",
justifyContent: "center",
flexDirection: "column",
gap: 14,
cursor: "pointer",
background:
"linear-gradient(180deg, rgba(0,0,0,0.88), rgba(18,18,18,0.96))",
boxShadow:
"0 0 25px rgba(236,72,153,0.18), 0 0 60px rgba(168,85,247,0.12)",
transition: "all 0.22s ease",
}}
>
<div
style={{
width: 88,
height: 88,
borderRadius: "50%",
display: "flex",
alignItems: "center",
justifyContent: "center",
background: "rgba(255,255,255,0.08)",
boxShadow: "0 0 40px rgba(236,72,153,0.35)",
fontSize: 42,
}}
>
🔒
</div>

<div
style={{
fontSize: 36,
fontWeight: 800,
fontFamily: "Gloock, serif",
color: "#fff",
}}
>
Locked Content 
</div>

<div
style={{
fontSize: 18,
opacity: 0.88,
color: "#fff",
}}
>
Unlock this post for $1.49 
</div>

<button
type="button"
onClick={(e) => {
e.preventDefault();
e.stopPropagation();
void unlockPost(p);
}}
style={{
marginTop: 8,
padding: "12px 26px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.55)",
background:
"linear-gradient(180deg, rgba(255,255,255,0.08), rgba(236,72,153,0.16))",
color: "#fff",
fontWeight: 800,
fontSize: 16,
cursor: "pointer",
}}
>
Unlock Now
</button>
</div>
) : isVideo ? (
<video
src={media}
controls
playsInline
preload="metadata"
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

{!isMine ? (
<>
<button
type="button"
onClick={(e) => {
e.preventDefault();
e.stopPropagation();
setOpenPostMenu((m) => ({ ...m, [p.id]: !m[p.id] }));
}}
style={{
position: "absolute",
top: 14,
right: 14,
zIndex: 20,
width: 34,
height: 34,
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.28)",
background: "rgba(0,0,0,0.55)",
color: "rgba(245,235,255,0.95)",
cursor: "pointer",
fontSize: 22,
fontWeight: 900,
lineHeight: "28px",
}}
>
⋯
</button>

{openPostMenu[p.id] ? (
<div
style={{
position: "absolute",
top: 52,
right: 14,
zIndex: 50,
minWidth: 150,
padding: 8,
borderRadius: 14,
background: "rgba(8,8,12,0.96)",
border: "1px solid rgba(168,85,247,0.28)",
boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
}}
>
<ReportPostButton
postId={p.id}
reportedUserId={p.user_id}
myUserId={myUserId}
onReported={(msg) => {
setBanner(msg);
setOpenPostMenu((m) => ({ ...m, [p.id]: false }));
}}
style={{
width: "100%",
border: "none",
background: "transparent",
color: "rgba(255,220,220,0.95)",
padding: "10px 12px",
cursor: "pointer",
fontWeight: 800,
fontSize: 13,
textAlign: "left",
}}
/>
</div>
) : null}
</>
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


{aboutModalOpen ? (
<div
onClick={() => setAboutModalOpen(false)}
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
<div style={{ fontSize: 24, fontWeight: 900 }}>About Me</div>

<button
type="button"
onClick={() => setAboutModalOpen(false)}
style={pillBtn}
>
Close
</button>
</div>

<div
style={{
marginTop: 16,
fontSize: 15,
lineHeight: 1.55,
whiteSpace: "pre-wrap",
color: "rgba(255,255,255,0.86)",
}}
>
{profile.bio}
</div>
</div>
</div>
) : null}
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
overflowY: "auto",
background: "rgba(0,0,0,0.88)",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 16,
padding: 14,
}}
>
<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
<button onClick={() => { if (!myUserId) return; setRelationshipTab("followers"); void loadRelationshipProfiles(myUserId, "followers"); }} style={tabBtn(relationshipTab === "followers")}>Followers</button>
<button onClick={() => { if (!myUserId) return; setRelationshipTab("following"); void loadRelationshipProfiles(myUserId, "following"); }} style={tabBtn(relationshipTab === "following")}>Following</button>
<button onClick={() => { if (!myUserId) return; setRelationshipTab("friends"); void loadRelationshipProfiles(myUserId, "friends"); }} style={tabBtn(relationshipTab === "friends")}>Friends</button>
<div style={{ flex: 1 }} />
<button onClick={() => setRelationshipModalOpen(false)} style={pillBtn}>Close</button>
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
<div
key={p.id}
style={{
position: "relative",
display: "flex",
alignItems: "center",
gap: 12,
padding: "12px 92px 12px 12px",
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.10)",
background: "rgba(0,0,0,0.18)",
color: "white",
}}
>
{p.avatar_url ? (
<img src={p.avatar_url} alt="" style={{ width: 46, height: 46, borderRadius: 999, objectFit: "cover", border: "1px solid rgba(255,255,255,0.16)" }} />
) : (
<div style={{ width: 46, height: 46, borderRadius: 999, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.04)", fontWeight: 800, opacity: 0.75 }}>
{(p.display_name || p.username || "?").charAt(0).toUpperCase()}
</div>
)}

<div style={{ minWidth: 0 }}>
<div style={{ fontWeight: 800 }}>{p.display_name || p.username || "Unknown"}</div>
{p.username ? <div style={{ opacity: 0.72, fontSize: 13 }}>@{p.username}</div> : null}
</div>

<button
type="button"
onClick={() => {
setRelationshipModalOpen(false);
router.push(`/u/${p.username || p.id}`);
}}
style={{
position: "absolute",
right: 12,
top: "50%",
transform: "translateY(-50%)",
padding: "7px 14px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.55)",
background: "rgba(236,72,153,0.18)",
color: "white",
fontWeight: 900,
cursor: "pointer",
}}
>
View
</button>
</div>
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
top: 110,
left: 0,
right: 0,
bottom: 0,
background: "rgba(0,0,0,0.82)",
display: "flex",
alignItems: "flex-start",
justifyContent: "center",
zIndex: 99999,
padding: "24px 16px 40px",
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
// eslint-disable-next-line @next/next/no-img-element
<img
src={currentGalleryItem.url}
alt=""
style={{
width: "100%",
borderRadius: 12,
maxHeight: "56vh",
objectFit: "contain",
display: "block",
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
maxHeight: "56vh",
background: "black",
display: "block",
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