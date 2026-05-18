"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useUnreadCount } from "./useUnreadCount";
import { useUnreadNotifications } from "./useUnreadNotifications";
import { useUnreadSignals } from "./useUnreadSignals";

export default function TopNav() {
const pathname = usePathname();
const router = useRouter();
const searchParams = useSearchParams();

const [q, setQ] = useState("");
const [mounted, setMounted] = useState(false);
const [restrictedNav, setRestrictedNav] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
function checkMobile() {
setIsMobile(window.innerWidth <= 640);
}

checkMobile();
window.addEventListener("resize", checkMobile);

return () => window.removeEventListener("resize", checkMobile);
}, []);
useEffect(() => {
setMounted(true);
}, []);

const { unread, refresh, supabase } = useUnreadCount();
const { notifUnread, refreshNotifs } = useUnreadNotifications();
const { signalUnread, refreshSignals } = useUnreadSignals();

useEffect(() => {
async function checkModerationStatus() {
const { data: authData } = await supabase.auth.getUser();
const user = authData?.user;
if (!user) return;

const { data: profile } = await supabase
.from("profiles")
.select("moderation_status,suspended_until")
.eq("id", user.id)
.maybeSingle();

const suspendedUntil = profile?.suspended_until
? new Date(profile.suspended_until)
: null;

const isBanned = profile?.moderation_status === "banned";
const isSuspended =
profile?.moderation_status === "suspended" &&
suspendedUntil &&
suspendedUntil.getTime() > Date.now();

setRestrictedNav(!!isBanned || !!isSuspended);
}

void checkModerationStatus();
}, [supabase, pathname]);

const refreshRef = useRef(refresh);
useEffect(() => {
refreshRef.current = refresh;
}, [refresh]);

const refreshNotifsRef = useRef(refreshNotifs);
useEffect(() => {
refreshNotifsRef.current = refreshNotifs;
}, [refreshNotifs]);

const refreshSignalsRef = useRef(refreshSignals);
useEffect(() => {
refreshSignalsRef.current = refreshSignals;
}, [refreshSignals]);

useEffect(() => {
const ch = supabase
.channel("messages-badge")
.on(
"postgres_changes",
{ event: "INSERT", schema: "public", table: "messages" },
() => refreshRef.current?.()
)
.subscribe();

return () => {
supabase.removeChannel(ch);
};
}, [supabase]);

useEffect(() => {
refresh();
refreshNotifs();
refreshSignals();

if (pathname === "/signals") {
const t = window.setTimeout(() => {
refreshSignals();
}, 700);

return () => window.clearTimeout(t);
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [pathname]);

useEffect(() => {
setQ(searchParams?.get("q") ?? "");
}, [searchParams]);

useEffect(() => {
setMenuOpen(false);
}, [pathname]);

const hideOn = new Set([
"/login",
"/signup",
"/forgot-password",
"/reset-password",
]);

const shouldHide = !!pathname && hideOn.has(pathname);
if (shouldHide || restrictedNav) return null;

const isActive = (href: string) => {
if (!pathname) return false;
if (href === "/feed") return pathname === "/feed" || pathname === "/";
return pathname === href || pathname.startsWith(href + "/");
};

const tabStyle = (active: boolean): React.CSSProperties => ({
fontFamily: '"Gloock", serif',
fontSize: 16,
fontWeight: 700,
letterSpacing: "0.2px",
textDecoration: "none",
padding: "8px 12px",
borderRadius: 999,
color: active ? "rgba(168,85,247,1)" : "rgba(168,85,247,0.65)",
textShadow: active
? "0 0 14px rgba(168,85,247,0.9), 0 0 26px rgba(168,85,247,0.55)"
: "none",
transition: "all 160ms ease",
display: "inline-flex",
alignItems: "center",
gap: 8,
});

const badgeStyle: React.CSSProperties = {
minWidth: 18,
height: 18,
padding: "0 5px",
borderRadius: 4,
fontSize: 11,
fontWeight: 900,
lineHeight: "18px",
color: "rgba(212, 169, 169, 0.92)",
background: "linear-gradient(180deg, rgba(241, 26, 194, 0.2), #ca04ba)",
border: "1px solid rgba(217, 62, 197, 0.35)",
boxShadow:
"0 0 14px rgba(190,24,93,0.85), 0 0 26px rgba(131,24,67,0.45)",
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
transform: "translateY(-1px)",
};

const menuItemStyle: React.CSSProperties = {
display: "flex",
alignItems: "center",
justifyContent: "space-between",
width: "100%",
padding: "10px 12px",
borderRadius: 12,
color: "rgba(245,235,255,0.9)",
textDecoration: "none",
fontFamily: '"Gloock", serif',
fontSize: 14,
fontWeight: 700,
};

const menuLabelStyle: React.CSSProperties = {
padding: "8px 12px 4px",
color: "rgba(216,180,254,0.58)",
fontSize: 11,
fontWeight: 900,
letterSpacing: "0.12em",
textTransform: "uppercase",
};

const onSubmit = (e: React.FormEvent) => {
e.preventDefault();
const trimmed = q.trim();
router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
};

const msgBadgeText = unread > 99 ? "99+" : String(unread);
const signalBadgeText = signalUnread > 99 ? "99+" : String(signalUnread);
const notifBadgeText = notifUnread > 99 ? "99+" : String(notifUnread);

return (
<div
style={{
position: "fixed",
top: 14,
left: "50%",
transform: "translateX(-50%)",
zIndex: 999999,
width: "min(100%, 980px)",
padding: "0 10px",
boxSizing: "border-box",
}}
>

<div
style={{
display: "flex",
alignItems: "center",
gap: isMobile ? 10 : 18,
padding: isMobile ? "8px 10px" : "10px 14px",
maxWidth: "100%",
width: "100%",
overflowX: "auto",
boxSizing: "border-box",
scrollbarWidth: "none",
borderRadius: 999,
background: "rgba(0,0,0,0.40)",
backdropFilter: "blur(12px)",
WebkitBackdropFilter: "blur(12px)",
boxShadow:
"0 18px 55px rgba(0,0,0,0.55), 0 0 28px rgba(168,85,247,0.22)",
border: "1px solid rgba(168,85,247,0.22)",
}}
>
<Link href="/feed" style={tabStyle(isActive("/feed"))}>
Feed
</Link>

<Link href="/explore" style={tabStyle(isActive("/explore"))}>
Explore
</Link>

<Link href="/profile" style={tabStyle(isActive("/profile"))}>
Profile
</Link>

<Link href="/messages" style={tabStyle(isActive("/messages"))}>
Messages
{unread > 0 && <span style={badgeStyle}>{msgBadgeText}</span>}
</Link>

<Link href="/signals" style={tabStyle(isActive("/signals"))}>
Signals
{signalUnread > 0 && <span style={badgeStyle}>{signalBadgeText}</span>}
</Link>

<Link href="/notifications" style={tabStyle(isActive("/notifications"))}>
Notifications
{notifUnread > 0 && <span style={badgeStyle}>{notifBadgeText}</span>}
</Link>

<form onSubmit={onSubmit}>
<div
style={{
display: "flex",
alignItems: "center",
gap: 8,
padding: "8px 12px",
borderRadius: 999,
background: "rgba(168,85,247,0.12)",
border: "1px solid rgba(168,85,247,0.22)",
}}
>
{mounted ? (
<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="Search"
autoComplete="off"
autoCorrect="off"
autoCapitalize="off"
spellCheck={false}
suppressHydrationWarning
style={{
width: 180,
background: "transparent",
border: "none",
outline: "none",
color: "rgba(168,85,247,1)",
fontSize: 14,
fontWeight: 700,
fontFamily: '"Gloock", serif',
}}
/>
) : (
<div style={{ width: 180, height: 22 }} />
)}
</div>
</form>

<div style={{ position: "relative" }}>
<button
type="button"
onClick={() => setMenuOpen((v) => !v)}
aria-label="Open menu"
style={{
width: 42,
height: 42,
borderRadius: 999,
border: "1px solid rgba(216,180,254,0.32)",
background:
"radial-gradient(circle at top, rgba(168,85,247,0.32), rgba(0,0,0,0.36))",
color: "rgba(245,235,255,0.95)",
fontSize: 22,
fontWeight: 900,
cursor: "pointer",
boxShadow:
menuOpen
? "0 0 18px rgba(168,85,247,0.55), inset 0 0 18px rgba(168,85,247,0.18)"
: "0 0 14px rgba(168,85,247,0.22)",
}}
>
☰
</button>

{menuOpen && (
<div
style={{
position: "absolute",
top: 54,
right: 0,
width: 250,
padding: 10,
borderRadius: 20,
background: "rgba(8,8,12,0.94)",
border: "1px solid rgba(168,85,247,0.28)",
boxShadow:
"0 24px 60px rgba(0,0,0,0.65), 0 0 34px rgba(168,85,247,0.22)",
backdropFilter: "blur(18px)",
WebkitBackdropFilter: "blur(18px)",
}}
>
<div style={menuLabelStyle}>Create</div>

<Link href="/events" style={menuItemStyle}>
Events <span>📅</span>
</Link>

<Link href="/events/new" style={menuItemStyle}>
Create Event <span>＋</span>
</Link>

<Link href="/writings" style={menuItemStyle}>
Writings <span>✎</span>
</Link>

<div style={menuLabelStyle}>Community</div>
<Link href="/game" style={menuItemStyle}>
Kinky Games <span>🎲</span>
</Link>
<Link href="/groups" style={menuItemStyle}>
Groups <span>◎</span>
</Link>

<div style={menuLabelStyle}>Account</div>
<Link href="/settings" style={menuItemStyle}>
Settings <span>⚙</span>
</Link>
<Link href="/settings/blocked" style={menuItemStyle}>
Blocked Users <span>⊘</span>
</Link>
</div>
)}
</div>
</div>
</div>
);
}