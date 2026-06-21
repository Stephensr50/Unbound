"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ProfileFeedClient from "./ProfileFeedClient";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
designation?: string | null;
age?: number | null;
is_admin?: boolean | null;
bio: string | null;
avatar_url: string | null;
city: string | null;
state: string | null;
country: string | null;
};

type ModalType = "followers" | "following" | "friends";

type UserKinkRow = {
id: string;
user_id: string;
kink: string;
interest: "into" | "curious" | "limit";
role: "giving" | "receiving" | "both" | "watching";
created_at: string;
};

export default function ProfilePage() {
const router = useRouter();

const supabase = useMemo(() => {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, anon);
}, []);

const [myUserId, setMyUserId] = useState<string | null>(null);
const [myProfile, setMyProfile] = useState<ProfileRow | null>(null);

const [followersCount, setFollowersCount] = useState<number>(0);
const [followingCount, setFollowingCount] = useState<number>(0);
const [friendsCount, setFriendsCount] = useState<number>(0);

const [modalOpen, setModalOpen] = useState(false);
const [modalType, setModalType] = useState<ModalType>("followers");
const [modalLoading, setModalLoading] = useState(false);
const [modalUsers, setModalUsers] = useState<ProfileRow[]>([]);

const [kinksOpen, setKinksOpen] = useState(false);
const [kinks, setKinks] = useState<UserKinkRow[]>([]);
const [newKink, setNewKink] = useState("");
const [newInterest, setNewInterest] =
useState<"into" | "curious" | "limit">("into");
const [newRole, setNewRole] =
useState<"giving" | "receiving" | "both" | "watching">("both");
const [savingKink, setSavingKink] = useState(false);

const [status, setStatus] = useState<string>("");

async function loadKinks(userId: string) {
const { data, error } = await supabase
.from("user_kinks")
.select("id,user_id,kink,interest,role,created_at")
.eq("user_id", userId)
.order("created_at", { ascending: false });

if (error) {
console.error("loadKinks error:", error.message);
return;
}

setKinks((data ?? []) as UserKinkRow[]);
}

async function addKink() {
if (!myUserId) return;

const clean = newKink.trim();
if (!clean) return;

setSavingKink(true);
setStatus("");

const { error } = await supabase.from("user_kinks").insert({
user_id: myUserId,
kink: clean,
interest: newInterest,
role: newRole,
});

setSavingKink(false);

if (error) {
setStatus(error.message);
return;
}

setNewKink("");
await loadKinks(myUserId);
}

async function deleteKink(id: string) {
if (!myUserId) return;

const { error } = await supabase.from("user_kinks").delete().eq("id", id);

if (error) {
setStatus(error.message);
return;
}

await loadKinks(myUserId);
}

useEffect(() => {
(async () => {
try {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);

if (uid) {
await loadKinks(uid);
}

if (!uid) {
setMyProfile(null);
setStatus("Not signed in.");
} else {
setStatus("");
}
} catch (e) {
console.error(e);
setMyUserId(null);
setMyProfile(null);
setStatus("Not signed in.");
}
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [supabase]);

useEffect(() => {
if (!myUserId) return;

(async () => {
const { data: p, error: pErr } = await supabase
.from("profiles")
.select(
"id, username, display_name, designation,age, bio, avatar_url, city, state, country, is_admin"
)
.eq("id", myUserId)
.maybeSingle();

if (pErr) console.error(pErr);
setMyProfile((p as ProfileRow) ?? null);

const { count: followers } = await supabase
.from("follows")
.select("*", { count: "exact", head: true })
.eq("following_id", myUserId);

setFollowersCount(followers ?? 0);

const { count: friends } = await supabase
.from("friends")
.select("*", { count: "exact", head: true })
.eq("user_id", myUserId);

setFriendsCount(friends ?? 0);

const { count: following } = await supabase
.from("follows")
.select("*", { count: "exact", head: true })
.eq("follower_id", myUserId);

setFollowingCount(following ?? 0);
})();
}, [supabase, myUserId]);

function openModal(type: ModalType) {
setModalType(type);
setModalOpen(true);
}

useEffect(() => {
if (!modalOpen || !myUserId) return;

(async () => {
setModalLoading(true);
setModalUsers([]);

try {
if (modalType === "friends") {
const { data: rows } = await supabase
.from("friends")
.select("friend_id")
.eq("user_id", myUserId);

const ids = (rows ?? []).map((r: any) => r.friend_id).filter(Boolean);
if (!ids.length) return;

const { data: profiles } = await supabase
.from("profiles")
.select(
"id, username, display_name, designation, bio, avatar_url, city, state, country, is_admin"
)
.in("id", ids);

setModalUsers((profiles ?? []) as ProfileRow[]);
return;
}

const isFollowers = modalType === "followers";

const { data: rows } = await supabase
.from("follows")
.select(isFollowers ? "follower_id" : "following_id")
.eq(isFollowers ? "following_id" : "follower_id", myUserId);

const ids =
(rows ?? []).map((r: any) =>
isFollowers ? r.follower_id : r.following_id
) ?? [];

if (!ids.length) return;

const { data: profiles } = await supabase
.from("profiles")
.select(
"id, username, display_name, designation, bio, avatar_url, city, state, country, is_admin"
)
.in("id", ids);

setModalUsers((profiles ?? []) as ProfileRow[]);
} finally {
setModalLoading(false);
}
})();
}, [modalOpen, modalType, myUserId, supabase]);

const title = myProfile?.display_name || myProfile?.username || "My Profile";
const locationLine = [myProfile?.city, myProfile?.state, myProfile?.country]
.filter(Boolean)
.join(", ");

const S = {
page: {
minHeight: "100vh",
padding: "28px 18px",
color: "rgba(255,255,255,0.92)",
fontFamily:
'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
} as const,

card: {
width: "100%",
maxWidth: 520,
margin: "0 auto",
borderRadius: 18,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(0,0,0,0.45)",
backdropFilter: "blur(14px)",
padding: 3,
} as const,

headerRow: { display: "flex", gap: 14, alignItems: "center" } as const,

avatar: {
height: 140,
width: 140,
borderRadius: "50%",
overflow: "hidden",
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
flex: "0 0 auto",
} as const,

name: {
fontSize: 30,
fontWeight: 800,
lineHeight: 1.05,
margin: 0,
} as const,

sub: {
marginTop: 6,
fontSize: 14,
color: "rgba(255,255,255,0.65)",
} as const,

btnRow: {
display: "flex",
gap: 10,
marginTop: 14,
flexWrap: "wrap" as const,
} as const,

btn: {
flex: "1 1 0",
height: 44,
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(255,255,255,0.10)",
color: "rgba(255,255,255,0.95)",
fontWeight: 650,
fontSize: 14,
display: "flex",
alignItems: "center",
justifyContent: "center",
cursor: "pointer",
textDecoration: "none",
} as const,

btnDanger: {
flex: "1 1 0",
height: 44,
borderRadius: 10,
border: "1px solid rgba(255,120,120,0.45)",
background: "rgba(255,80,80,0.12)",
color: "rgba(255,255,255,0.95)",
fontWeight: 800,
fontSize: 14,
display: "flex",
alignItems: "center",
justifyContent: "center",
cursor: "pointer",
} as const,

statsWrap: {
marginTop: 14,
borderTop: "1px solid rgba(255,255,255,0.12)",
borderBottom: "1px solid rgba(255,255,255,0.12)",
display: "grid",
gridTemplateColumns: "1fr 1fr 1fr",
} as const,

stat: {
padding: "12px 8px",
textAlign: "center" as const,
cursor: "pointer",
userSelect: "none" as const,
} as const,

statMiddle: {
borderLeft: "1px solid rgba(255,255,255,0.12)",
borderRight: "1px solid rgba(255,255,255,0.12)",
} as const,

statNum: {
fontSize: 18,
fontWeight: 800,
color: "rgba(255,255,255,0.92)",
lineHeight: 1.1,
} as const,

statLabel: {
fontSize: 12,
color: "rgba(255,255,255,0.60)",
marginTop: 4,
} as const,

modalBackdrop: {
position: "fixed" as const,
inset: 0,
background: "rgba(0,0,0,0.62)",
display: "flex",
alignItems: "center",
justifyContent: "center",
zIndex: 9999,
padding: 14,
} as const,

modal: {
width: "100%",
maxWidth: 420,
borderRadius: 16,
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(0,0,0,0.72)",
backdropFilter: "blur(14px)",
padding: 12,
} as const,

modalHeader: {
display: "flex",
alignItems: "center",
justifyContent: "space-between",
paddingBottom: 8,
borderBottom: "1px solid rgba(255,255,255,0.10)",
marginBottom: 10,
} as const,

modalTitle: { fontWeight: 800, color: "rgba(255,255,255,0.92)" } as const,

closeBtn: {
border: "none",
background: "transparent",
color: "rgba(255,255,255,0.75)",
cursor: "pointer",
fontSize: 14,
} as const,

list: {
maxHeight: "62vh",
overflowY: "auto" as const,
display: "flex",
flexDirection: "column" as const,
gap: 8,
paddingTop: 4,
} as const,

userRow: {
display: "flex",
alignItems: "center",
gap: 10,
padding: 10,
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
textDecoration: "none",
color: "rgba(255,255,255,0.92)",
} as const,

userAvatar: {
height: 40,
width: 40,
borderRadius: 999,
overflow: "hidden",
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
flex: "0 0 auto",
} as const,

userName: { fontWeight: 700, fontSize: 14 } as const,
userHandle: { fontSize: 12, color: "rgba(255,255,255,0.60)" } as const,
};

async function shareProfile() {
const shareText = `Check out my Unbound profile: ${window.location.href}`;

try {
// @ts-ignore
if (navigator.share) {
// @ts-ignore
await navigator.share({ text: shareText, url: window.location.href });
return;
}
} catch {}

try {
await navigator.clipboard.writeText(shareText);
alert("Profile link copied.");
} catch {
alert(shareText);
}
}

async function signOut() {
setStatus("");
const { error } = await supabase.auth.signOut();
if (error) {
setStatus(`Sign out error: ${error.message}`);
return;
}

setMyUserId(null);
setMyProfile(null);
router.push("/login");
}

const isAdmin = myProfile?.is_admin === true;

return (
<div style={{ ...S.page, marginTop: "80px" }}>
<div style={S.card}>
<div style={S.headerRow}>
<div style={S.avatar}>
{myProfile?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={`${myProfile.avatar_url}?t=${Date.now()}`}
alt=""
style={{ height: "100%", width: "100%", objectFit: "cover" }}
/>
) : (
<div
style={{
height: "100%",
width: "100%",
display: "flex",
alignItems: "center",
justifyContent: "center",
color: "rgba(255,255,255,0.35)",
fontWeight: 800,
fontSize: 18,
}}
>
—
</div>
)}
</div>

<div style={{ minWidth: 0, flex: 1 }}>
<h1 style={S.name}>{title}</h1>
{myProfile?.designation || myProfile?.age ? (
<div style={S.sub}>
{[myProfile?.designation, myProfile?.age].filter(Boolean).join(" • ")}
</div>
) : null}
{locationLine ? <div style={S.sub}>{locationLine}</div> : null}
</div>
</div>

<div style={S.btnRow}>
<Link href="/edit-profile" style={S.btn}>
Edit Profile
</Link>

{isAdmin ? (
<Link href="/admin/reports" style={S.btn}>
Admin Dashboard
</Link>
) : null}

<button type="button" style={S.btn} onClick={shareProfile}>
Share Profile
</button>

<button type="button" style={S.btnDanger} onClick={signOut}>
Sign Out
</button>
</div>

{status ? (
<div style={{ marginTop: 10, color: "#ffb3b3", padding: "0 2px" }}>
{status}
</div>
) : null}

<div style={S.statsWrap}>
<div style={S.stat} onClick={() => openModal("friends")}>
<div style={S.statNum}>{friendsCount}</div>
<div style={S.statLabel}>Friends</div>
</div>

<div
style={{ ...S.stat, ...S.statMiddle }}
onClick={() => openModal("followers")}
>
<div style={S.statNum}>{followersCount}</div>
<div style={S.statLabel}>Followers</div>
</div>

<div style={S.stat} onClick={() => openModal("following")}>
<div style={S.statNum}>{followingCount}</div>
<div style={S.statLabel}>Following</div>
</div>
</div>
</div>

<div
style={{
width: "100%",
maxWidth: 520,
margin: "16px auto 0",
padding: 14,
borderRadius: 14,
border: "1px solid rgba(236,72,153,0.35)",
background: "rgba(0,0,0,0.35)",
boxShadow: "0 0 14px rgba(236,72,153,0.12)",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
}}
>
<div style={{ fontWeight: 900, fontSize: 18 }}>Kinks & Interests</div>

<button
type="button"
style={{ ...S.btn, flex: "0 0 auto", padding: "0 14px" }}
onClick={() => setKinksOpen(true)}
>
Edit
</button>
</div>

<div style={{ marginTop: 10, color: "rgba(255,255,255,0.68)" }}>
{kinks.length === 0 ? "No kinks added yet." : `${kinks.length} saved`}
</div>
</div>

{myUserId ? <ProfileFeedClient /> : null}

{modalOpen ? (
<div style={S.modalBackdrop} onClick={() => setModalOpen(false)}>
<div style={S.modal} onClick={(e) => e.stopPropagation()}>
<div style={S.modalHeader}>
<div style={S.modalTitle}>
{modalType === "followers"
? "Followers"
: modalType === "following"
? "Following"
: "Friends"}
</div>
<button style={S.closeBtn} onClick={() => setModalOpen(false)}>
Close
</button>
</div>

{modalLoading ? (
<div
style={{
padding: 18,
textAlign: "center",
color: "rgba(255,255,255,0.70)",
}}
>
Loading…
</div>
) : modalUsers.length === 0 ? (
<div
style={{
padding: 18,
textAlign: "center",
color: "rgba(255,255,255,0.70)",
}}
>
No one yet.
</div>
) : (
<div style={S.list}>
{modalUsers.map((u) => {
const label = u.display_name || u.username || "User";
const href = `/u/${u.username || u.id}`;

return (
<Link
key={u.id}
href={href}
style={{
...S.userRow,
justifyContent: "space-between",
}}
onClick={() => setModalOpen(false)}
>
<div
style={{
display: "flex",
alignItems: "center",
gap: 10,
minWidth: 0,
}}
>
<div style={S.userAvatar}>
{u.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={u.avatar_url}
alt=""
style={{
height: "100%",
width: "100%",
objectFit: "cover",
}}
/>
) : (
<div
style={{
height: "100%",
width: "100%",
display: "flex",
alignItems: "center",
justifyContent: "center",
color: "rgba(255,255,255,0.35)",
fontWeight: 900,
fontSize: 12,
}}
>
—
</div>
)}
</div>

<div style={{ minWidth: 0 }}>
<div style={S.userName}>{label}</div>
{u.username ? (
<div style={S.userHandle}>@{u.username}</div>
) : null}
</div>
</div>

<div
style={{
flex: "0 0 auto",
padding: "6px 12px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.55)",
background: "rgba(236,72,153,0.16)",
color: "white",
fontWeight: 900,
fontSize: 13,
}}
>
View
</div>
</Link>
);
})}
</div>
)}
</div>
</div>
) : null}

{kinksOpen ? (
<div
style={{
position: "fixed",
inset: 0,
zIndex: 9999,
background: "rgba(0,0,0,0.74)",
backdropFilter: "blur(14px)",
WebkitBackdropFilter: "blur(14px)",
display: "flex",
alignItems: "center",
justifyContent: "center",
padding: 16,
}}
onClick={() => setKinksOpen(false)}
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
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
marginBottom: 14,
}}
>
<div>
<div style={{ fontSize: 24, fontWeight: 900 }}>
Kinks & Interests
</div>
<div style={{ opacity: 0.72, fontSize: 13, marginTop: 4 }}>
This opens in a privacy blur so your face and list are not
visible together.
</div>
</div>

<button
type="button"
style={S.closeBtn}
onClick={() => setKinksOpen(false)}
>
Close
</button>
</div>

<div
style={{
display: "grid",
gridTemplateColumns: "1fr",
gap: 10,
padding: 12,
borderRadius: 16,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.05)",
marginBottom: 14,
}}
>
<input
value={newKink}
onChange={(e) => setNewKink(e.target.value)}
placeholder="Type a kink or interest..."
style={{
height: 42,
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.45)",
color: "white",
padding: "0 12px",
outline: "none",
}}
/>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<select
value={newInterest}
onChange={(e) =>
setNewInterest(
e.target.value as "into" | "curious" | "limit"
)
}
style={{
flex: "1 1 160px",
height: 42,
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.45)",
color: "white",
padding: "0 12px",
}}
>
<option value="into">Into</option>
<option value="curious">Curious about</option>
<option value="limit">Limit</option>
</select>

<select
value={newRole}
onChange={(e) =>
setNewRole(
e.target.value as
| "giving"
| "receiving"
| "both"
| "watching"
)
}
style={{
flex: "1 1 160px",
height: 42,
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.45)",
color: "white",
padding: "0 12px",
}}
>
<option value="both">Both</option>
<option value="giving">Giving</option>
<option value="receiving">Receiving</option>
<option value="watching">Watching</option>
</select>
</div>

<button
type="button"
style={{
...S.btn,
flex: "none",
border: "1px solid rgba(236,72,153,0.45)",
boxShadow: "0 0 12px rgba(236,72,153,0.25)",
}}
disabled={savingKink || !newKink.trim()}
onClick={addKink}
>
{savingKink ? "Saving..." : "Add"}
</button>
</div>

{(["into", "curious", "limit"] as const).map((section) => {
const rows = kinks.filter((k) => k.interest === section);
if (rows.length === 0) return null;

return (
<div key={section} style={{ marginBottom: 16 }}>
<div
style={{
fontWeight: 900,
marginBottom: 8,
color:
section === "limit"
? "rgba(255,150,150,0.95)"
: "rgba(255,235,250,0.95)",
}}
>
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
display: "inline-flex",
alignItems: "center",
gap: 8,
padding: "8px 10px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(168,85,247,0.12)",
boxShadow: "0 0 10px rgba(168,85,247,0.16)",
fontSize: 13,
fontWeight: 750,
}}
>
<span>{k.kink}</span>
<span style={{ opacity: 0.62 }}>({k.role})</span>
<button
type="button"
onClick={() => deleteKink(k.id)}
style={{
border: "none",
background: "transparent",
color: "rgba(255,255,255,0.65)",
cursor: "pointer",
fontWeight: 900,
}}
>
×
</button>
</div>
))}
</div>
</div>
);
})}

{kinks.length === 0 ? (
<div style={{ opacity: 0.68, textAlign: "center", padding: 18 }}>
No kinks added yet.
</div>
) : null}
</div>
</div>
) : null}
</div>
);
}