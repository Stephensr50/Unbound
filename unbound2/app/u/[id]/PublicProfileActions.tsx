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

const btnBase: React.CSSProperties = {
padding: "10px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.45)",
color: "white",
cursor: "pointer",
fontWeight: 750,
letterSpacing: 0.2,
};

const primaryBtn: React.CSSProperties = {
...btnBase,
border: "none",
background: "linear-gradient(90deg,#7c3aed,#c026d3)",
boxShadow: "0 0 14px rgba(168,85,247,0.55)",
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
setBanner(
"Friend requests table not set up yet (we can add it next). Error: " +
String(e?.message || e)
);
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
<button onClick={onMessage} style={primaryBtn}>
Message
</button>

<button onClick={toggleFollow} disabled={followBusy} style={btnBase}>
{followBusy ? "…" : following ? "Following ✓" : "Follow"}
</button>

<button
onClick={sendFriendRequest}
disabled={friendBusy}
style={btnBase}
>
{friendBusy ? "…" : "Add Friend"}
</button>
</div>
</div>
);
}