"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

// Tries multiple table strategies so you don’t hard-crash if your schema name differs.
// It will run the first one that works.
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

export default function PublicProfileActions({
targetProfileId,
}: {
targetProfileId: string;
}) {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [myUid, setMyUid] = useState<string | null>(null);
const [banner, setBanner] = useState<string | null>(null);

const [following, setFollowing] = useState<boolean>(false);
const [followBusy, setFollowBusy] = useState(false);

const [friendBusy, setFriendBusy] = useState(false);

// Hover state for glow/lift
const [hover, setHover] = useState<"message" | "follow" | "friend" | null>(
null
);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUid(uid);
return uid;
}

useEffect(() => {
(async () => {
const uid = await refreshAuth();
if (!uid) return;

// Check follow status if possible (we try a couple common table/column conventions)
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
.from("user_follows")
.select("id")
.eq("follower_id", uid)
.eq("following_id", targetProfileId)
.maybeSingle();
if (error) throw error;
return !!data;
},
]);
setFollowing(isFollowing);
} catch {
// If follow tables don’t exist yet, just ignore (UI still renders)
}
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [targetProfileId]);

// ===== Glass button styles (12px, more square, frosted) =====
const btnBase: React.CSSProperties = {
padding: "10px 14px",
borderRadius: 12,

// brighter edge so it reads on rope bg
borderWidth: 1,
borderStyle: "solid",
borderColor: "rgba(169, 85, 247, 0.71)",

// less black, more frosted
background: "rgba(255, 255, 255, 0.21)",

backdropFilter: "blur(12px)",
WebkitBackdropFilter: "blur(12px)",

// stronger text contrast
color: "rgba(255,255,255,0.98)",
fontFamily: '"Gloock", serif',

fontWeight: 800,
letterSpacing: 0.2,
cursor: "pointer",

// subtle base glow even when not hovered
boxShadow: "0 0 12px rgba(168,85,247,0.25)",

transition:
"transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease, opacity 140ms ease",
};

const primaryBtn: React.CSSProperties = {
...btnBase,
borderWidth: 1,
borderStyle: "solid",
borderColor: "rgba(168,85,247,0.55)",
background:
"linear-gradient(180deg, rgba(168,85,247,0.85), rgba(120,60,255,0.85))",
color: "white",
boxShadow:
"0 0 18px rgba(168,85,247,0.55), inset 0 0 12px rgba(255,255,255,0.14)",
};

const disabledBtn: React.CSSProperties = {
opacity: 0.65,
cursor: "not-allowed",
transform: "none",
};

const idleGlow = "0 0 12px rgba(168,85,247,0.25)";
const hoverGlow = "0 0 26px rgba(168,85,247,0.75)";

const applyHover = (
base: React.CSSProperties,
key: "message" | "follow" | "friend",
disabled?: boolean
): React.CSSProperties => {
if (disabled) return { ...base, ...disabledBtn };
const isOn = hover === key;
return {
...base,
boxShadow: isOn
? (base.boxShadow ? `${base.boxShadow}, ${hoverGlow}` : hoverGlow)
: (base.boxShadow ? `${base.boxShadow}, ${idleGlow}` : idleGlow),
transform: isOn ? "translateY(-1px)" : "translateY(0px)",
borderColor: isOn ? "rgba(168,85,247,0.65)" : (base.borderColor as any),
};
};

async function onMessage() {
const uid = myUid ?? (await refreshAuth());
if (!uid) {
setBanner("Please sign in to message.");
return;
}
if (uid === targetProfileId) {
setBanner("That’s you 😄");
return;
}

// Your app already uses /messages/[id] with profile.id in several places
router.push(`/messages/${targetProfileId}`);
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
// Unfollow
await tryTables([
async () => {
const { error } = await supabase
.from("follows")
.delete()
.eq("follower_id", uid)
.eq("following_id", targetProfileId);
if (error) throw error;
},
async () => {
const { error } = await supabase
.from("user_follows")
.delete()
.eq("follower_id", uid)
.eq("following_id", targetProfileId);
if (error) throw error;
},
]);
setFollowing(false);
} else {
// Follow
await tryTables([
async () => {
const { error } = await supabase.from("follows").insert({
follower_id: uid,
following_id: targetProfileId,
});
if (error) throw error;
},
async () => {
const { error } = await supabase.from("user_follows").insert({
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

if (friendBusy) return;
setFriendBusy(true);
setBanner(null);

try {
// We try a couple common naming schemes. If none exist yet,
// you’ll get a clear banner instead of a crash.
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

setBanner("Friend request sent ✅");
} catch (e: any) {
const msg = String(e?.message || e).toLowerCase();

if (msg.includes("duplicate key") || msg.includes("unique")) {
setBanner("Friend request already pending ✓");
} else {
setBanner(String(e?.message || e));
}
} finally {
setFriendBusy(false);
}
}

// Hide actions if you’re viewing your own profile
if (myUid && myUid === targetProfileId) return null;

return (
<div style={{ marginTop: 14 }}>
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
style={applyHover(primaryBtn, "message", false)}
onMouseEnter={() => setHover("message")}
onMouseLeave={() => setHover(null)}
>
Message
</button>

<button
onClick={toggleFollow}
disabled={followBusy}
style={applyHover(btnBase, "follow", followBusy)}
onMouseEnter={() => !followBusy && setHover("follow")}
onMouseLeave={() => setHover(null)}
>
{followBusy ? "…" : following ? "Following ✓" : "Follow"}
</button>

<button
onClick={sendFriendRequest}
disabled={friendBusy}
style={applyHover(btnBase, "friend", friendBusy)}
onMouseEnter={() => !friendBusy && setHover("friend")}
onMouseLeave={() => setHover(null)}
>
{friendBusy ? "…" : "Add Friend"}
</button>
</div>
</div>
);
}