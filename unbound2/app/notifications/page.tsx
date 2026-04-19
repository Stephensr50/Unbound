"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type ProfileMini = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

type NotifRow = {
id: number;
user_id: string;
actor_id: string | null;
type: string;
entity_id: string | null;
title: string | null;
message: string | null;
body: string | null;
href: string | null;
link: string | null;
comment_id: string | null;
read_at: string | null;
created_at: string;

actor?: ProfileMini | null;
};

function timeAgo(ts: string) {
const t = new Date(ts).getTime();
const s = Math.floor((Date.now() - t) / 1000);
if (s < 10) return "just now";
if (s < 60) return `${s}s ago`;
const m = Math.floor(s / 60);
if (m < 60) return `${m}m ago`;
const h = Math.floor(m / 60);
if (h < 24) return `${h}h ago`;
const d = Math.floor(h / 24);
return `${d}d ago`;
}

export default function NotificationsPage() {
const router = useRouter();
const supabase = useMemo(() => getSupabase(), []);

const [me, setMe] = useState<string | null>(null);
const [rows, setRows] = useState<NotifRow[]>([]);
const [loading, setLoading] = useState(true);

const loadingRef = useRef(false);
const subscribedRef = useRef(false);

async function refreshMe() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMe(uid);
return uid;
}

async function hydrateActors(notifs: NotifRow[]) {
const ids = Array.from(
new Set(
notifs
.map((n) => n.actor_id)
.filter((x): x is string => !!x && x.length > 0)
)
);

if (ids.length === 0) return notifs;

const { data: profs, error } = await supabase
.from("profiles")
.select("id, username, display_name, avatar_url")
.in("id", ids);

if (error || !profs) return notifs;

const map = new Map<string, ProfileMini>();
for (const p of profs as any[]) {
map.set(p.id, {
id: p.id,
username: p.username ?? null,
display_name: p.display_name ?? null,
avatar_url: p.avatar_url ?? null,
});
}

return notifs.map((n) => ({
...n,
actor: n.actor_id ? map.get(n.actor_id) ?? null : null,
}));
}

async function loadNotifications() {
if (loadingRef.current) return;
loadingRef.current = true;

try {
setLoading(true);

const uid = me ?? (await refreshMe());
if (!uid) {
setRows([]);
return;
}

const { data, error } = await supabase
.from("notifications")
.select(
"id,user_id,actor_id,type,entity_id,title,message,body,href,link,comment_id,read_at,created_at"
)
.eq("user_id", uid)
.order("created_at", { ascending: false })
.limit(60);

if (error) {
console.error(error);
setRows([]);
return;
}

const base = (data ?? []) as NotifRow[];
const withActors = await hydrateActors(base);
setRows(withActors);
} finally {
setLoading(false);
loadingRef.current = false;
}
}

async function markAllRead() {
const uid = me ?? (await refreshMe());
if (!uid) return;

await supabase
.from("notifications")
.update({ read_at: new Date().toISOString() })
.eq("user_id", uid)
.is("read_at", null);

await loadNotifications();
}

async function markOneRead(id: number) {
await supabase
.from("notifications")
.update({ read_at: new Date().toISOString() })
.eq("id", id);

setRows((prev) =>
prev.map((n) =>
n.id === id ? { ...n, read_at: new Date().toISOString() } : n
)
);
}

function computeHref(n: NotifRow) {
if (n.type === "friend_request") return "/friend-requests";
if (n.type === "message") return "/messages";

if (n.type === "spank" || n.type === "comment" || n.type === "comment_reply") {
const postId = Number(n.entity_id);
if (Number.isFinite(postId) && postId > 0) {
return `/post/${postId}?flash=4000`;
}
}

if (n.href) return n.href;
if (n.link) return n.link;

if ((n.type === "follow" || n.type === "followed_you") && n.actor_id) {
return `/u/${n.actor_id}`;
}

return null;
}

async function onClickNotif(n: NotifRow) {
const href = computeHref(n);
console.log("CLICK NOTIF:", {
type: n.type,
entity_id: n.entity_id,
comment_id: n.comment_id,
href,
rawHref: n.href,
rawLink: n.link,
});

if (href) router.push(href, { scroll: false });

markOneRead(n.id).catch((e) => console.error("markOneRead failed:", e));
}

useEffect(() => {
(async () => {
await refreshMe();
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
if (!me) return;

let alive = true;

loadNotifications();

const ch = supabase
.channel(`notifications-page-${me}`)
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "notifications",
filter: `user_id=eq.${me}`,
},
() => {
if (alive) loadNotifications();
}
)
.subscribe();

return () => {
alive = false;
supabase.removeChannel(ch);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [me]);

const wrap: React.CSSProperties = {
minHeight: "100vh",
paddingTop: 84,
paddingBottom: 40,
color: "white",
};

const title: React.CSSProperties = {
fontFamily: '"Gloock", serif',
fontSize: 34,
fontWeight: 700,
letterSpacing: 0.2,
margin: "18px 0 14px",
textShadow: "0 0 14px rgba(168,85,247,0.20)",
};

const card: React.CSSProperties = {
maxWidth: 880,
margin: "0 auto",
padding: "0 16px",
};

const list: React.CSSProperties = {
display: "flex",
flexDirection: "column",
gap: 12,
marginTop: 12,
};

const rowStyle = (unread: boolean): React.CSSProperties => ({
display: "flex",
alignItems: "center",
gap: 12,
padding: "14px 14px",
borderRadius: 16,
cursor: "pointer",
background: unread ? "rgba(168,85,247,0.10)" : "rgba(0,0,0,0.28)",
border: unread
? "1px solid rgba(168,85,247,0.35)"
: "1px solid rgba(168,85,247,0.16)",
boxShadow: unread
? "0 0 22px rgba(168,85,247,0.22)"
: "0 0 18px rgba(0,0,0,0.25)",
backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
});

const avatarWrap: React.CSSProperties = {
width: 42,
height: 42,
borderRadius: 999,
overflow: "hidden",
border: "1px solid rgba(168,85,247,0.35)",
boxShadow: "0 0 14px rgba(168,85,247,0.20)",
flex: "0 0 auto",
background: "rgba(0,0,0,0.35)",
display: "grid",
placeItems: "center",
};

const avatarImg: React.CSSProperties = {
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
};

const fallbackInitial: React.CSSProperties = {
fontFamily: '"Gloock", serif',
fontWeight: 800,
color: "rgba(168,85,247,1)",
textShadow: "0 0 16px rgba(168,85,247,0.55)",
};

const mainText: React.CSSProperties = {
display: "flex",
flexDirection: "column",
gap: 2,
minWidth: 0,
};

const topLine: React.CSSProperties = {
fontFamily: '"Gloock", serif',
fontSize: 16,
fontWeight: 800,
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
};

const subLine: React.CSSProperties = {
opacity: 0.8,
fontSize: 13,
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
};

const right: React.CSSProperties = {
marginLeft: "auto",
opacity: 0.7,
fontSize: 12,
flex: "0 0 auto",
};

const markAllBtn: React.CSSProperties = {
marginLeft: "auto",
padding: "8px 12px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(168,85,247,0.12)",
color: "rgba(255,255,255,0.95)",
fontWeight: 800,
cursor: "pointer",
boxShadow: "0 0 18px rgba(168,85,247,0.20)",
};

function buildText(n: NotifRow) {
const actorName =
n.actor?.display_name ||
(n.actor?.username ? `@${n.actor.username}` : null) ||
"Someone";

if (n.type === "spank") return `${actorName} spanked your post`;
if (n.type === "comment") return `${actorName} commented on your post`;
if (n.type === "friend_request") return `${actorName} sent you a friend request`;
if (n.type === "message") return `${actorName} messaged you`;
return n.title || n.message || n.body || "Notification";
}

function buildSub(n: NotifRow) {
if (n.type === "spank" || n.type === "comment") return "Tap to open post";
if (n.type === "friend_request") return "Tap to open friend requests";
if (n.type === "message") return "Tap to open messages";
return n.body || n.message || "";
}

const unreadCount = rows.filter((r) => !r.read_at).length;

return (
<div style={wrap}>
<div style={card}>
<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<div style={title}>Notifications</div>
<button onClick={markAllRead} style={markAllBtn}>
Mark all read {unreadCount > 0 ? `(${unreadCount})` : ""}
</button>
</div>

{loading ? (
<div style={{ opacity: 0.75, marginTop: 16 }}>Loading…</div>
) : rows.length === 0 ? (
<div style={{ opacity: 0.75, marginTop: 16 }}>No notifications yet.</div>
) : (
<div style={list}>
{rows.map((n) => {
const unread = !n.read_at;
const who =
n.actor?.display_name ||
(n.actor?.username ? `@${n.actor.username}` : null) ||
"U";
const initial = who.trim().charAt(0).toUpperCase();

return (
<div
key={n.id}
style={rowStyle(unread)}
onClick={() => onClickNotif(n)}
role="button"
>
<div style={avatarWrap}>
{n.actor?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={n.actor.avatar_url} alt="" style={avatarImg} />
) : (
<div style={fallbackInitial}>{initial}</div>
)}
</div>

<div style={mainText}>
<div style={topLine}>{buildText(n)}</div>
<div style={subLine}>{buildSub(n)}</div>
</div>

<div style={right}>{timeAgo(n.created_at)}</div>
</div>
);
})}
</div>
)}
</div>
</div>
);
}