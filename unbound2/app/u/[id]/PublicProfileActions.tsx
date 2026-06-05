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
type HoverKey = "message" | "follow" | "friend" | "coffee" | "safety" | null;
type ReportReason =
| "Harassment"
| "Spam"
| "Fake account"
| "Underage user"
| "Threatening behavior"
| "Non-consensual content"
| "Other";

export default function PublicProfileActions({
targetProfileId,
buyMeACoffeeUrl,
}: {
targetProfileId: string;
buyMeACoffeeUrl?: string | null;
}) {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [myUid, setMyUid] = useState<string | null>(null);
const [banner, setBanner] = useState<string | null>(null);

const [following, setFollowing] = useState(false);
const [followBusy, setFollowBusy] = useState(false);

const [friendBusy, setFriendBusy] = useState(false);
const [friendState, setFriendState] = useState<FriendState>("none");

const [showTipModal, setShowTipModal] = useState(false);
const [tipAmount, setTipAmount] = useState("5");
const [tipMessage, setTipMessage] = useState("");
const [tipBusy, setTipBusy] = useState(false);

const [hover, setHover] = useState<HoverKey>(null);
const [safetyOpen, setSafetyOpen] = useState(false);
const [blockBusy, setBlockBusy] = useState(false);
const [isBlocked, setIsBlocked] = useState(false);

const [showReportModal, setShowReportModal] = useState(false);
const [reportReason, setReportReason] = useState<ReportReason>("Harassment");
const [reportDetails, setReportDetails] = useState("");
const [reportBusy, setReportBusy] = useState(false);

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


try {
const { data, error } = await supabase
.from("blocked_users")
.select("id")
.eq("blocker_id", uid)
.eq("blocked_id", targetProfileId)
.maybeSingle();

if (error) throw error;
setIsBlocked(!!data);
} catch {
setIsBlocked(false);
}
await refreshFriendState(uid);
})();
}, [supabase, targetProfileId]);

async function toggleBlock() {
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to block users.");
return;
}

if (uid === targetProfileId) {
setBanner("You can’t block yourself 😄");
return;
}

if (blockBusy) return;

const action = isBlocked ? "unblock" : "block";
const confirmed = window.confirm(
isBlocked
? "Unblock this user?"
: "Block this user? They won’t be able to interact with you."
);

if (!confirmed) return;

setBlockBusy(true);
setBanner(null);

try {
if (action === "block") {
const { error } = await supabase.from("blocked_users").insert({
blocker_id: uid,
blocked_id: targetProfileId,
});

if (error) throw error;

setIsBlocked(true);
setSafetyOpen(false);
setBanner("User blocked.");
} else {
const { error } = await supabase
.from("blocked_users")
.delete()
.eq("blocker_id", uid)
.eq("blocked_id", targetProfileId);

if (error) throw error;

setIsBlocked(false);
setSafetyOpen(false);
setBanner("User unblocked.");
}
} catch (e: any) {
setBanner(String(e?.message || e || "Could not update block."));
} finally {
setBlockBusy(false);
}
}

async function submitReport() {
   
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to report users.");
return;
}

if (uid === targetProfileId) {
setBanner("You can't report yourself.");
return;
}

if (reportBusy) return;

setReportBusy(true);
setBanner(null);

try {
const { error } = await supabase.from("reports").insert({
reporter_id: uid,
reported_user_id: targetProfileId,
reason: reportReason,
details: reportDetails.trim() || null,
status: "open",
});

if (error) throw error;

setShowReportModal(false);
setSafetyOpen(false);
setReportReason("Harassment");
setReportDetails("");
setBanner("Report submitted. Thank you for helping keep Unbound safe.");
} catch (e: any) {
setBanner(String(e?.message || e || "Could not submit report."));
} finally {
setReportBusy(false);
}
}


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

const primaryBtn: CSSProperties = {
...btnBase,
background:
"linear-gradient(180deg, rgba(168,85,247,0.98), rgba(140,80,255,0.98))",
boxShadow:
"0 0 28px rgba(168,85,247,0.9), inset 0 0 16px rgba(255,255,255,0.28)",
borderColor: "rgba(210,160,255,0.9)",
color: "#ffffff",
};

const messageBtn: CSSProperties = {
...btnBase,
background:
"linear-gradient(180deg, rgba(168,85,247,0.98), rgba(140,80,255,0.98))",
boxShadow:
"0 0 28px rgba(168,85,247,0.9), inset 0 0 16px rgba(255,255,255,0.28)",
borderColor: "rgba(210,160,255,0.9)",
color: "#ffffff",
};

const coffeeBtn: CSSProperties = {
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

function getMessagePriceLabel() {
return "Free";
}

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
try {
const { data: blocked, error: blockedError } = await supabase
.from("blocked_users")
.select("id")
.or(
`and(blocker_id.eq.${uid},blocked_id.eq.${targetProfileId}),and(blocker_id.eq.${targetProfileId},blocked_id.eq.${uid})`
)
.limit(1);

if (blockedError) throw blockedError;

if ((blocked ?? []).length > 0) {
setBanner("Messaging unavailable.");
return;
}
} catch {
setBanner("Could not verify block status.");
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
type HoverKey = "message" | "follow" | "friend" | "coffee" | "safety" | null;
type ReportReason =
| "Harassment"
| "Spam"
| "Fake account"
| "Underage user"
| "Threatening behavior"
| "Non-consensual content"
| "Other";

export default function PublicProfileActions({
targetProfileId,
buyMeACoffeeUrl,
}: {
targetProfileId: string;
buyMeACoffeeUrl?: string | null;
}) {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [myUid, setMyUid] = useState<string | null>(null);
const [banner, setBanner] = useState<string | null>(null);

const [following, setFollowing] = useState(false);
const [followBusy, setFollowBusy] = useState(false);

const [friendBusy, setFriendBusy] = useState(false);
const [friendState, setFriendState] = useState<FriendState>("none");

const [showTipModal, setShowTipModal] = useState(false);
const [tipAmount, setTipAmount] = useState("5");
const [tipMessage, setTipMessage] = useState("");
const [tipBusy, setTipBusy] = useState(false);

const [hover, setHover] = useState<HoverKey>(null);
const [safetyOpen, setSafetyOpen] = useState(false);
const [blockBusy, setBlockBusy] = useState(false);
const [isBlocked, setIsBlocked] = useState(false);

const [showReportModal, setShowReportModal] = useState(false);
const [reportReason, setReportReason] = useState<ReportReason>("Harassment");
const [reportDetails, setReportDetails] = useState("");
const [reportBusy, setReportBusy] = useState(false);

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


try {
const { data, error } = await supabase
.from("blocked_users")
.select("id")
.eq("blocker_id", uid)
.eq("blocked_id", targetProfileId)
.maybeSingle();

if (error) throw error;
setIsBlocked(!!data);
} catch {
setIsBlocked(false);
}
await refreshFriendState(uid);
})();
}, [supabase, targetProfileId]);

async function toggleBlock() {
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to block users.");
return;
}

if (uid === targetProfileId) {
setBanner("You can’t block yourself 😄");
return;
}

if (blockBusy) return;

const action = isBlocked ? "unblock" : "block";
const confirmed = window.confirm(
isBlocked
? "Unblock this user?"
: "Block this user? They won’t be able to interact with you."
);

if (!confirmed) return;

setBlockBusy(true);
setBanner(null);

try {
if (action === "block") {
const { error } = await supabase.from("blocked_users").insert({
blocker_id: uid,
blocked_id: targetProfileId,
});

if (error) throw error;

setIsBlocked(true);
setSafetyOpen(false);
setBanner("User blocked.");
} else {
const { error } = await supabase
.from("blocked_users")
.delete()
.eq("blocker_id", uid)
.eq("blocked_id", targetProfileId);

if (error) throw error;

setIsBlocked(false);
setSafetyOpen(false);
setBanner("User unblocked.");
}
} catch (e: any) {
setBanner(String(e?.message || e || "Could not update block."));
} finally {
setBlockBusy(false);
}
}

async function submitReport() {
   
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to report users.");
return;
}

if (uid === targetProfileId) {
setBanner("You can't report yourself.");
return;
}

if (reportBusy) return;

setReportBusy(true);
setBanner(null);

try {
const { error } = await supabase.from("reports").insert({
reporter_id: uid,
reported_user_id: targetProfileId,
reason: reportReason,
details: reportDetails.trim() || null,
status: "open",
});

if (error) throw error;

setShowReportModal(false);
setSafetyOpen(false);
setReportReason("Harassment");
setReportDetails("");
setBanner("Report submitted. Thank you for helping keep Unbound safe.");
} catch (e: any) {
setBanner(String(e?.message || e || "Could not submit report."));
} finally {
setReportBusy(false);
}
}


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

const primaryBtn: CSSProperties = {
...btnBase,
background:
"linear-gradient(180deg, rgba(168,85,247,0.98), rgba(140,80,255,0.98))",
boxShadow:
"0 0 28px rgba(168,85,247,0.9), inset 0 0 16px rgba(255,255,255,0.28)",
borderColor: "rgba(210,160,255,0.9)",
color: "#ffffff",
};

const messageBtn: CSSProperties = {
...btnBase,
background:
"linear-gradient(180deg, rgba(168,85,247,0.98), rgba(140,80,255,0.98))",
boxShadow:
"0 0 28px rgba(168,85,247,0.9), inset 0 0 16px rgba(255,255,255,0.28)",
borderColor: "rgba(210,160,255,0.9)",
color: "#ffffff",
};

const coffeeBtn: CSSProperties = {
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

function getMessagePriceLabel() {
return "Free";
}

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
try {
const { data: blocked, error: blockedError } = await supabase
.from("blocked_users")
.select("id")
.or(
`and(blocker_id.eq.${uid},blocked_id.eq.${targetProfileId}),and(blocker_id.eq.${targetProfileId},blocked_id.eq.${uid})`
)
.limit(1);

if (blockedError) throw blockedError;

if ((blocked ?? []).length > 0) {
setBanner("Messaging unavailable.");
return;
}
} catch {
setBanner("Could not verify block status.");
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

if (json.requires_payment) {
const checkoutRes = await fetch("/api/checkout", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
checkoutType: "message",
conversationId: json.conversation_id,
payerId: uid,
receiverId: targetProfileId,
priceCents: json.price_cents,
}),
});

const checkoutJson = await checkoutRes.json().catch(() => ({}));

if (!checkoutRes.ok) {
throw new Error(checkoutJson?.error ?? "Could not start checkout");
}

window.location.href = checkoutJson.url;
return;
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

async function sendTip() {
try {
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to send a tip.");
return;
}

if (uid === targetProfileId) {
setBanner("That’s you 😄");
return;
}

if (tipBusy) return;

setTipBusy(true);
setBanner(null);

const res = await fetch("/api/tips/create-checkout", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
senderId: uid,
recipientId: targetProfileId,
amountCents: Math.round(Number(tipAmount) * 100),
message: tipMessage.trim() || null,
}),
});

const json = await res.json().catch(() => ({}));

if (!res.ok) {
throw new Error(json?.error || "Could not start tip checkout.");
}

if (!json.url) {
throw new Error("Checkout URL missing.");
}

window.location.href = json.url;
} catch (err: any) {
setBanner(err?.message || "Something went wrong");
} finally {
setTipBusy(false);
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

@keyframes coffeePulseGlow {
0% {
filter: drop-shadow(0 0 10px rgba(236,72,153,0.24))
drop-shadow(0 0 18px rgba(192,38,211,0.14));
}
50% {
filter: drop-shadow(0 0 18px rgba(236,72,153,0.45))
drop-shadow(0 0 30px rgba(192,38,211,0.22));
}
100% {
filter: drop-shadow(0 0 10px rgba(236,72,153,0.24))
drop-shadow(0 0 18px rgba(192,38,211,0.14));
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
{`Message ${getMessagePriceLabel()}`}
</button>

<button
onClick={() => setShowTipModal(true)}
style={{
...applyHover(coffeeBtn, "coffee", false),
}}
onMouseEnter={() => setHover("coffee")}
onMouseLeave={() => setHover(null)}
title="Support this creator"
>
Buy Me a Coffee
</button>

{friendState !== "friends" && (
<button
onClick={toggleFollow}
disabled={followBusy}
style={applyHover(primaryBtn, "follow", followBusy)}
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
<div style={{ position: "relative" }}>
<button
onClick={() => setSafetyOpen((v) => !v)}
style={{
...applyHover(btnBase, "safety", false),
minWidth: 52,
fontSize: 22,
lineHeight: 1,
paddingTop: 6,
paddingBottom: 10,
}}
onMouseEnter={() => setHover("safety")}
onMouseLeave={() => setHover(null)}
title="Safety options"
>
⋯
</button>

{safetyOpen ? (
<div
style={{
position: "absolute",
top: "calc(100% + 8px)",
right: 0,
width: 220,
borderRadius: 16,
overflow: "hidden",
background: "rgba(15,15,20,0.96)",
border: "1px solid rgba(168,85,247,0.35)",
boxShadow:
"0 0 24px rgba(168,85,247,0.28), 0 0 44px rgba(0,0,0,0.45)",
zIndex: 200,
backdropFilter: "blur(14px)",
WebkitBackdropFilter: "blur(14px)",
}}
>
<button
onClick={toggleBlock}
disabled={blockBusy}
style={{
width: "100%",
textAlign: "left",
padding: "14px 16px",
background: "transparent",
border: "none",
color: "white",
cursor: blockBusy ? "not-allowed" : "pointer",
fontWeight: 700,
borderBottom: "1px solid rgba(255,255,255,0.06)",
}}
>
{blockBusy
? "Working..."
: isBlocked
? "Unblock User"
: "Block User"}
</button>

<button
onClick={() => {
setSafetyOpen(false);
setShowReportModal(true);
}}
style={{
width: "100%",
textAlign: "left",
padding: "14px 16px",
background: "transparent",
border: "none",
color: "rgba(255,120,120,0.95)",
cursor: "pointer",
fontWeight: 700,
}}
>
Report User
</button>
</div>
) : null}
</div>
</div>

{showTipModal ? (
<div
onClick={() => {
if (tipBusy) return;
setShowTipModal(false);
}}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.72)",
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
width: "min(500px, 92vw)",
background: "rgba(0,0,0,0.9)",
border: "1px solid rgba(236,72,153,0.35)",
borderRadius: 20,
padding: 20,
boxShadow:
"0 0 22px rgba(236,72,153,0.22), 0 0 44px rgba(168,85,247,0.18)",
backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
}}
>
<div
style={{
fontSize: 26,
fontWeight: 900,
marginBottom: 10,
color: "rgba(236,72,153,0.95)",
textShadow: "0 0 12px rgba(168,85,247,0.45)",
fontFamily: '"Gloock", serif',
}}
>
Send Tip 💸
</div>

<div
style={{
opacity: 0.78,
marginBottom: 14,
color: "rgba(255,255,255,0.92)",
}}
>
Add a message with your tip 😈
</div>
<input
value={tipAmount}
onChange={(e) => setTipAmount(e.target.value)}
type="number"
min="1"
step="1"
placeholder="Tip amount"
style={{
width: "100%",
background: "rgba(255,255,255,0.04)",
color: "white",
border: "1px solid rgba(168,85,247,0.3)",
borderRadius: 14,
padding: "12px 14px",
outline: "none",
marginBottom: 14,
fontWeight: 800,
}}
/>
<textarea
value={tipMessage}
onChange={(e) => setTipMessage(e.target.value)}
placeholder="Write something sweet..."
rows={4}
style={{
width: "100%",
resize: "none",
background: "rgba(255,255,255,0.04)",
color: "white",
border: "1px solid rgba(168,85,247,0.3)",
borderRadius: 14,
padding: "12px 14px",
outline: "none",
marginBottom: 14,
}}
/>

<div
style={{
display: "flex",
justifyContent: "flex-end",
gap: 10,
}}
>
<button
onClick={() => {
if (tipBusy) return;
setShowTipModal(false);
}}
style={{
padding: "10px 16px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.4)",
color: "white",
cursor: tipBusy ? "not-allowed" : "pointer",
fontWeight: 700,
opacity: tipBusy ? 0.65 : 1,
}}
>
Cancel
</button>

<button
onClick={sendTip}
disabled={tipBusy}
style={{
padding: "10px 18px",
borderRadius: 999,
border: "none",
cursor: tipBusy ? "not-allowed" : "pointer",
fontWeight: 800,
color: "white",
background: "linear-gradient(90deg,#ec4899,#a855f7)",
boxShadow: "0 0 16px rgba(168,85,247,0.55)",
opacity: tipBusy ? 0.65 : 1,
}}
>
{tipBusy ? "Sending..." : "Send Tip"}
</button>
</div>
</div>
</div>
) : null}
{showReportModal ? (
<div
onClick={() => {
if (reportBusy) return;
setShowReportModal(false);
}}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.72)",
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
width: "min(500px, 92vw)",
background: "rgba(0,0,0,0.92)",
border: "1px solid rgba(255,80,80,0.28)",
borderRadius: 20,
padding: 20,
boxShadow:
"0 0 22px rgba(255,80,80,0.18), 0 0 44px rgba(168,85,247,0.18)",
backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
}}
>
<div
style={{
fontSize: 26,
fontWeight: 900,
marginBottom: 10,
color: "rgba(255,120,120,0.96)",
fontFamily: '"Gloock", serif',
}}
>
Report User
</div>

<div
style={{
opacity: 0.78,
marginBottom: 14,
color: "rgba(255,255,255,0.92)",
}}
>
Help us keep Unbound safe.
</div>

<select
value={reportReason}
onChange={(e) =>
setReportReason(e.target.value as ReportReason)
}
style={{
width: "100%",
marginBottom: 14,
background: "rgba(255,255,255,0.05)",
color: "white",
border: "1px solid rgba(168,85,247,0.25)",
borderRadius: 12,
padding: "12px 14px",
}}
>
<option>Harassment</option>
<option>Spam</option>
<option>Fake account</option>
<option>Underage user</option>
<option>Threatening behavior</option>
<option>Non-consensual content</option>
<option>Other</option>
</select>

<textarea
value={reportDetails}
onChange={(e) => setReportDetails(e.target.value)}
placeholder="Additional details..."
rows={4}
style={{
width: "100%",
resize: "none",
background: "rgba(255,255,255,0.04)",
color: "white",
border: "1px solid rgba(168,85,247,0.3)",
borderRadius: 14,
padding: "12px 14px",
outline: "none",
marginBottom: 14,
}}
/>

<div
style={{
display: "flex",
justifyContent: "flex-end",
gap: 10,
}}
>
<button
onClick={() => {
if (reportBusy) return;
setShowReportModal(false);
}}
style={{
padding: "10px 16px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.4)",
color: "white",
cursor: reportBusy ? "not-allowed" : "pointer",
fontWeight: 700,
opacity: reportBusy ? 0.65 : 1,
}}
>
Cancel
</button>

<button
onClick={submitReport}
disabled={reportBusy}
style={{
padding: "10px 18px",
borderRadius: 999,
border: "none",
cursor: reportBusy ? "not-allowed" : "pointer",
fontWeight: 800,
color: "white",
background: "linear-gradient(90deg,#ff4d6d,#a855f7)",
boxShadow: "0 0 16px rgba(255,80,80,0.4)",
opacity: reportBusy ? 0.65 : 1,
}}
>
{reportBusy ? "Submitting..." : "Submit Report"}
</button>
</div>
</div>
</div>
) : null}
</div>
);
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

async function sendTip() {
try {
const uid = myUid ?? (await refreshAuth());

if (!uid) {
setBanner("Please sign in to send a tip.");
return;
}

if (uid === targetProfileId) {
setBanner("That’s you 😄");
return;
}

if (tipBusy) return;

setTipBusy(true);
setBanner(null);

const res = await fetch("/api/tips/create-checkout", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
senderId: uid,
recipientId: targetProfileId,
amountCents: Math.round(Number(tipAmount) * 100),
message: tipMessage.trim() || null,
}),
});

const json = await res.json().catch(() => ({}));

if (!res.ok) {
throw new Error(json?.error || "Could not start tip checkout.");
}

if (!json.url) {
throw new Error("Checkout URL missing.");
}

window.location.href = json.url;
} catch (err: any) {
setBanner(err?.message || "Something went wrong");
} finally {
setTipBusy(false);
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

@keyframes coffeePulseGlow {
0% {
filter: drop-shadow(0 0 10px rgba(236,72,153,0.24))
drop-shadow(0 0 18px rgba(192,38,211,0.14));
}
50% {
filter: drop-shadow(0 0 18px rgba(236,72,153,0.45))
drop-shadow(0 0 30px rgba(192,38,211,0.22));
}
100% {
filter: drop-shadow(0 0 10px rgba(236,72,153,0.24))
drop-shadow(0 0 18px rgba(192,38,211,0.14));
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
{`Message ${getMessagePriceLabel()}`}
</button>

<button
onClick={() => setShowTipModal(true)}
style={{
...applyHover(coffeeBtn, "coffee", false),
}}
onMouseEnter={() => setHover("coffee")}
onMouseLeave={() => setHover(null)}
title="Support this creator"
>
Buy Me a Coffee
</button>

{friendState !== "friends" && (
<button
onClick={toggleFollow}
disabled={followBusy}
style={applyHover(primaryBtn, "follow", followBusy)}
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
<div style={{ position: "relative" }}>
<button
onClick={() => setSafetyOpen((v) => !v)}
style={{
...applyHover(btnBase, "safety", false),
minWidth: 52,
fontSize: 22,
lineHeight: 1,
paddingTop: 6,
paddingBottom: 10,
}}
onMouseEnter={() => setHover("safety")}
onMouseLeave={() => setHover(null)}
title="Safety options"
>
⋯
</button>

{safetyOpen ? (
<div
style={{
position: "absolute",
top: "calc(100% + 8px)",
right: 0,
width: 220,
borderRadius: 16,
overflow: "hidden",
background: "rgba(15,15,20,0.96)",
border: "1px solid rgba(168,85,247,0.35)",
boxShadow:
"0 0 24px rgba(168,85,247,0.28), 0 0 44px rgba(0,0,0,0.45)",
zIndex: 200,
backdropFilter: "blur(14px)",
WebkitBackdropFilter: "blur(14px)",
}}
>
<button
onClick={toggleBlock}
disabled={blockBusy}
style={{
width: "100%",
textAlign: "left",
padding: "14px 16px",
background: "transparent",
border: "none",
color: "white",
cursor: blockBusy ? "not-allowed" : "pointer",
fontWeight: 700,
borderBottom: "1px solid rgba(255,255,255,0.06)",
}}
>
{blockBusy
? "Working..."
: isBlocked
? "Unblock User"
: "Block User"}
</button>

<button
onClick={() => {
setSafetyOpen(false);
setShowReportModal(true);
}}
style={{
width: "100%",
textAlign: "left",
padding: "14px 16px",
background: "transparent",
border: "none",
color: "rgba(255,120,120,0.95)",
cursor: "pointer",
fontWeight: 700,
}}
>
Report User
</button>
</div>
) : null}
</div>
</div>

{showTipModal ? (
<div
onClick={() => {
if (tipBusy) return;
setShowTipModal(false);
}}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.72)",
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
width: "min(500px, 92vw)",
background: "rgba(0,0,0,0.9)",
border: "1px solid rgba(236,72,153,0.35)",
borderRadius: 20,
padding: 20,
boxShadow:
"0 0 22px rgba(236,72,153,0.22), 0 0 44px rgba(168,85,247,0.18)",
backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
}}
>
<div
style={{
fontSize: 26,
fontWeight: 900,
marginBottom: 10,
color: "rgba(236,72,153,0.95)",
textShadow: "0 0 12px rgba(168,85,247,0.45)",
fontFamily: '"Gloock", serif',
}}
>
Send Tip 💸
</div>

<div
style={{
opacity: 0.78,
marginBottom: 14,
color: "rgba(255,255,255,0.92)",
}}
>
Add a message with your tip 😈
</div>
<input
value={tipAmount}
onChange={(e) => setTipAmount(e.target.value)}
type="number"
min="1"
step="1"
placeholder="Tip amount"
style={{
width: "100%",
background: "rgba(255,255,255,0.04)",
color: "white",
border: "1px solid rgba(168,85,247,0.3)",
borderRadius: 14,
padding: "12px 14px",
outline: "none",
marginBottom: 14,
fontWeight: 800,
}}
/>
<textarea
value={tipMessage}
onChange={(e) => setTipMessage(e.target.value)}
placeholder="Write something sweet..."
rows={4}
style={{
width: "100%",
resize: "none",
background: "rgba(255,255,255,0.04)",
color: "white",
border: "1px solid rgba(168,85,247,0.3)",
borderRadius: 14,
padding: "12px 14px",
outline: "none",
marginBottom: 14,
}}
/>

<div
style={{
display: "flex",
justifyContent: "flex-end",
gap: 10,
}}
>
<button
onClick={() => {
if (tipBusy) return;
setShowTipModal(false);
}}
style={{
padding: "10px 16px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.4)",
color: "white",
cursor: tipBusy ? "not-allowed" : "pointer",
fontWeight: 700,
opacity: tipBusy ? 0.65 : 1,
}}
>
Cancel
</button>

<button
onClick={sendTip}
disabled={tipBusy}
style={{
padding: "10px 18px",
borderRadius: 999,
border: "none",
cursor: tipBusy ? "not-allowed" : "pointer",
fontWeight: 800,
color: "white",
background: "linear-gradient(90deg,#ec4899,#a855f7)",
boxShadow: "0 0 16px rgba(168,85,247,0.55)",
opacity: tipBusy ? 0.65 : 1,
}}
>
{tipBusy ? "Sending..." : "Send Tip"}
</button>
</div>
</div>
</div>
) : null}
{showReportModal ? (
<div
onClick={() => {
if (reportBusy) return;
setShowReportModal(false);
}}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.72)",
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
width: "min(500px, 92vw)",
background: "rgba(0,0,0,0.92)",
border: "1px solid rgba(255,80,80,0.28)",
borderRadius: 20,
padding: 20,
boxShadow:
"0 0 22px rgba(255,80,80,0.18), 0 0 44px rgba(168,85,247,0.18)",
backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
}}
>
<div
style={{
fontSize: 26,
fontWeight: 900,
marginBottom: 10,
color: "rgba(255,120,120,0.96)",
fontFamily: '"Gloock", serif',
}}
>
Report User
</div>

<div
style={{
opacity: 0.78,
marginBottom: 14,
color: "rgba(255,255,255,0.92)",
}}
>
Help us keep Unbound safe.
</div>

<select
value={reportReason}
onChange={(e) =>
setReportReason(e.target.value as ReportReason)
}
style={{
width: "100%",
marginBottom: 14,
background: "rgba(255,255,255,0.05)",
color: "white",
border: "1px solid rgba(168,85,247,0.25)",
borderRadius: 12,
padding: "12px 14px",
}}
>
<option>Harassment</option>
<option>Spam</option>
<option>Fake account</option>
<option>Underage user</option>
<option>Threatening behavior</option>
<option>Non-consensual content</option>
<option>Other</option>
</select>

<textarea
value={reportDetails}
onChange={(e) => setReportDetails(e.target.value)}
placeholder="Additional details..."
rows={4}
style={{
width: "100%",
resize: "none",
background: "rgba(255,255,255,0.04)",
color: "white",
border: "1px solid rgba(168,85,247,0.3)",
borderRadius: 14,
padding: "12px 14px",
outline: "none",
marginBottom: 14,
}}
/>

<div
style={{
display: "flex",
justifyContent: "flex-end",
gap: 10,
}}
>
<button
onClick={() => {
if (reportBusy) return;
setShowReportModal(false);
}}
style={{
padding: "10px 16px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.4)",
color: "white",
cursor: reportBusy ? "not-allowed" : "pointer",
fontWeight: 700,
opacity: reportBusy ? 0.65 : 1,
}}
>
Cancel
</button>

<button
onClick={submitReport}
disabled={reportBusy}
style={{
padding: "10px 18px",
borderRadius: 999,
border: "none",
cursor: reportBusy ? "not-allowed" : "pointer",
fontWeight: 800,
color: "white",
background: "linear-gradient(90deg,#ff4d6d,#a855f7)",
boxShadow: "0 0 16px rgba(255,80,80,0.4)",
opacity: reportBusy ? 0.65 : 1,
}}
>
{reportBusy ? "Submitting..." : "Submit Report"}
</button>
</div>
</div>
</div>
) : null}
</div>
);
}