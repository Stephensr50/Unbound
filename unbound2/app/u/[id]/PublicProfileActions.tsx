"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

async function tryTables<T>(attempts: Array<() => Promise<T>>): Promise<T> {
let lastErr: any = null;

for (const fn of attempts) {
try {
return await fn();
} catch (e: any) {
lastErr = e;
}
}

throw lastErr ?? new Error("Operation failed");
}

type FriendState = "none" | "pending_out" | "pending_in" | "friends";
type HoverKey = "message" | "follow" | "friend" | null;

export default function PublicProfileActions({
targetProfileId,
}: {
targetProfileId: string;
}) {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [myUid, setMyUid] = useState<string | null>(null);
const [banner, setBanner] = useState<string | null>(null);

const [following, setFollowing] = useState(false);
const [followBusy, setFollowBusy] = useState(false);

const [friendBusy, setFriendBusy] = useState(false);
const [friendState, setFriendState] = useState<FriendState>("none");

const [hover, setHover] = useState<HoverKey>(null);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUid(uid);
return uid;
}

async function refreshFriendState(uid: string) {
if (!uid || uid === targetProfileId) {
setFriendState("none");
return;
}

try {
const isFriends = await tryTables<boolean>([
async () => {
const { data, error } = await supabase
.from("friends")
.select("user_id, friend_id")
.or(
`and(user_id.eq.${uid},friend_id.eq.${targetProfileId}),and(user_id.eq.${targetProfileId},friend_id.eq.${uid})`
)
.limit(1);

if (error) throw error;
return (data ?? []).length > 0;
},
async () => {
const { data, error } = await supabase
.from("friends")
.select("user_id, friend_user_id")
.or(
`and(user_id.eq.${uid},friend_user_id.eq.${targetProfileId}),and(user_id.eq.${targetProfileId},friend_user_id.eq.${uid})`
)
.limit(1);

if (error) throw error;
return (data ?? []).length > 0;
},
]);

if (isFriends) {
setFriendState("friends");
return;
}
} catch {
// ignore schema mismatch
}

try {
const state = await tryTables<FriendState>([
async () => {
const { data, error } = await supabase
.from("friend_requests")
.select("requester_id, receiver_id, status")
.or(
`and(requester_id.eq.${uid},receiver_id.eq.${targetProfileId}),and(requester_id.eq.${targetProfileId},receiver_id.eq.${uid})`
)
.limit(10);

if (error) throw error;

const rows: any[] = data ?? [];
const pending = rows.find(
(r) =>
String(r.status ?? "pending").toLowerCase() === "pending" ||
String(r.status ?? "").toLowerCase() === ""
);

if (!pending) return "none";
return pending.requester_id === uid ? "pending_out" : "pending_in";
},
async () => {
const { data, error } = await supabase
.from("friend_requests")
.select("from_user_id, to_user_id, status")
.or(
`and(from_user_id.eq.${uid},to_user_id.eq.${targetProfileId}),and(from_user_id.eq.${targetProfileId},to_user_id.eq.${uid})`
)
.limit(10);

if (error) throw error;

const rows: any[] = data ?? [];
const pending = rows.find(
(r) =>
String(r.status ?? "pending").toLowerCase() === "pending" ||
String(r.status ?? "").toLowerCase() === ""
);

if (!pending) return "none";
return pending.from_user_id === uid ? "pending_out" : "pending_in";
},
]);

setFriendState(state);
} catch {
setFriendState("none");
}
}

useEffect(() => {
void (async () => {
const uid = await refreshAuth();
if (!uid) return;

try {
const isFollowing = await tryTables<boolean>([
async () => {
const { data, error } = await supabase
.from("follows")
.select("id")
.eq("follower_id", uid)
.eq("following_id", targetProfileId)
.maybeSingle();

if (error) throw error;
return !!data;
},
async () => {
const { data, error } = await supabase
.from("follows")
.select("follower_id")
.eq("follower_id", uid)
.eq("following_id", targetProfileId)
.maybeSingle();

if (error) throw error;
return !!data;
},
]);

setFollowing(isFollowing);
} catch {
// ignore
}

await refreshFriendState(uid);
})();
}, [supabase, targetProfileId]);

const btnBase: CSSProperties = {
padding: "10px 14px",
borderRadius: 12,
borderWidth: 1,
borderStyle: "solid",
borderColor: "rgba(169, 85, 247, 0.71)",
background: "rgba(169, 85, 247, 0.18)",
backdropFilter: "blur(12px)",
WebkitBackdropFilter: "blur(12px)",
color: "rgba(255,255,255,0.98)",
fontFamily: '"Gloock", serif',
fontWeight: 800,
letterSpacing: 0.2,
cursor: "pointer",
boxShadow: "0 0 12px rgba(168,85,247,0.25)",
transition:
"transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease, opacity 140ms ease",
};

const primaryBtn: React.CSSProperties = {
...btnBase,
background:
"linear-gradient(180deg, rgba(168,85,247,0.98), rgba(140,80,255,0.98))",
boxShadow:
"0 0 28px rgba(168,85,247,0.9), inset 0 0 16px rgba(255,255,255,0.28)",
borderColor: "rgba(210,160,255,0.9)",
color: "#ffffff",
};

const messageBtn: React.CSSProperties = {
...btnBase,
background:
"linear-gradient(180deg, rgba(168,85,247,0.98), rgba(140,80,255,0.98))",
boxShadow:
"0 0 28px rgba(168,85,247,0.9), inset 0 0 16px rgba(255,255,255,0.28)",
borderColor: "rgba(210,160,255,0.9)",
color: "#ffffff",
};

const disabledBtn: CSSProperties = {
opacity: 0.65,
cursor: "not-allowed",
transform: "none",
};

const idleGlow = "0 0 12px rgba(168,85,247,0.25)";
const hoverGlow = "0 0 26px rgba(168,85,247,0.75)";

const applyHover = (
base: CSSProperties,
key: Exclude<HoverKey, null>,
disabled?: boolean
): CSSProperties => {
if (disabled) return { ...base, ...disabledBtn };

const isOn = hover === key;

return {
...base,
boxShadow: isOn
? base.boxShadow
? `${base.boxShadow}, ${hoverGlow}`
: hoverGlow
: base.boxShadow
? `${base.boxShadow}, ${idleGlow}`
: idleGlow,
transform: isOn ? "translateY(-1px)" : "translateY(0px)",
borderColor: isOn
? "rgba(168,85,247,0.65)"
: (base.borderColor as CSSProperties["borderColor"]),
};
};

async function onMessage() {
try {
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to message.");
return;
}

if (uid === targetProfileId) {
setBanner("That’s you 😄");
return;
}

setBanner(null);

const { data: sessionData } = await supabase.auth.getSession();
const accessToken = sessionData.session?.access_token ?? "";

const res = await fetch("/api/conversations/get-or-create", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${accessToken}`,
},
body: JSON.stringify({ to: targetProfileId }),
});

const json = await res.json().catch(() => ({}));

if (!res.ok) {
throw new Error(json?.error ?? "Could not start conversation");
}

router.push(`/messages/${json.conversation_id}`);
} catch (e: any) {
setBanner(String(e?.message || e || "Could not start conversation"));
}
}

async function toggleFollow() {
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to follow.");
return;
}

if (uid === targetProfileId) {
setBanner("You can’t follow yourself 😄");
return;
}

if (followBusy) return;

setFollowBusy(true);
setBanner(null);

try {
if (following) {
await tryTables([
async () => {
const { error } = await supabase
.from("follows")
.delete()
.eq("follower_id", uid)
.eq("following_id", targetProfileId);

if (error) throw error;
},
]);

setFollowing(false);
} else {
await tryTables([
async () => {
const { error } = await supabase.from("follows").insert({
follower_id: uid,
following_id: targetProfileId,
});

if (error) throw error;
},
]);

setFollowing(true);
}
} catch (e: any) {
setBanner(String(e?.message || e));
} finally {
setFollowBusy(false);
}
}

async function sendFriendRequest() {
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to send a friend request.");
return;
}

if (uid === targetProfileId) {
setBanner("That’s you 😄");
return;
}

await refreshFriendState(uid);

if (friendState === "friends") {
setBanner("You’re already friends ✓");
return;
}

if (friendState === "pending_out") {
setBanner("Friend request already pending ✓");
return;
}

if (friendState === "pending_in") {
setBanner("They already requested you — accept it in Notifications ✓");
return;
}

if (friendBusy) return;

setFriendBusy(true);
setBanner(null);

try {
await tryTables([
async () => {
const { error } = await supabase.from("friend_requests").insert({
requester_id: uid,
receiver_id: targetProfileId,
status: "pending",
});

if (error) throw error;
},
async () => {
const { error } = await supabase.from("friend_requests").insert({
from_user_id: uid,
to_user_id: targetProfileId,
status: "pending",
});

if (error) throw error;
},
]);

setFriendState("pending_out");
setBanner("Friend request sent ✅");
} catch (e: any) {
const msg = String(e?.message || e).toLowerCase();

if (msg.includes("duplicate key") || msg.includes("unique")) {
setFriendState("pending_out");
setBanner("Friend request already pending ✓");
} else {
setBanner(String(e?.message || e));
}
} finally {
setFriendBusy(false);
}
}

if (myUid && myUid === targetProfileId) return null;

const friendBtnDisabled =
friendBusy ||
friendState === "friends" ||
friendState === "pending_out" ||
friendState === "pending_in";

const friendBtnLabel = friendBusy
? "…"
: friendState === "friends"
? "Friends ✓"
: friendState === "pending_out"
? "Request Sent ✓"
: friendState === "pending_in"
? "Requested You ✓"
: "Add Friend";

return (
<div style={{ marginTop: 14 }}>
<style>{`
@keyframes messagePulseGlow {
0% {
filter: drop-shadow(0 0 8px rgba(168,85,247,0.28))
drop-shadow(0 0 14px rgba(192,38,211,0.18));
}
50% {
filter: drop-shadow(0 0 16px rgba(168,85,247,0.52))
drop-shadow(0 0 28px rgba(192,38,211,0.30));
}
100% {
filter: drop-shadow(0 0 8px rgba(168,85,247,0.28))
drop-shadow(0 0 14px rgba(192,38,211,0.18));
}
}
`}</style>

{banner ? (
<div
style={{
marginBottom: 10,
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

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button
onClick={onMessage}
style={{
...applyHover(messageBtn, "message", false),
animation: "messagePulseGlow 1.6s ease-in-out infinite",
willChange: "filter",
}}
onMouseEnter={() => setHover("message")}
onMouseLeave={() => setHover(null)}
>
Message
</button>

{friendState !== "friends" && (
<button
onClick={toggleFollow}
disabled={followBusy}
style={applyHover(btnBase, "follow", followBusy)}
onMouseEnter={() => !followBusy && setHover("follow")}
onMouseLeave={() => setHover(null)}
>
{followBusy ? "…" : following ? "Following ✓" : "Follow"}
</button>
)}

<button
onClick={sendFriendRequest}
disabled={friendBtnDisabled}
style={applyHover(primaryBtn, "friend", friendBtnDisabled)}
onMouseEnter={() => !friendBtnDisabled && setHover("friend")}
onMouseLeave={() => setHover(null)}
title={
friendState === "pending_in"
? "They requested you — accept it in Notifications"
: friendState === "pending_out"
? "Friend request already sent"
: friendState === "friends"
? "You’re already friends"
: "Send friend request"
}
>
{friendBtnLabel}
</button>
</div>
</div>
);
}