"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useUnreadCount } from "./useUnreadCount";

export default function TopNav() {
const pathname = usePathname();
const router = useRouter();
const searchParams = useSearchParams();

// ---------- state ----------
const [q, setQ] = useState("");
const [mounted, setMounted] = useState(false);

useEffect(() => {
setMounted(true);
}, []);

// ---------- unread badge ----------
const { unread, refresh, supabase } = useUnreadCount();

const refreshRef = useRef(refresh);
useEffect(() => {
refreshRef.current = refresh;
}, [refresh]);

// realtime subscription (stable)
useEffect(() => {
const channel = supabase
.channel("messages-badge")
.on(
"postgres_changes",
{ event: "INSERT", schema: "public", table: "messages" },
() => refreshRef.current?.()
)
.subscribe();

return () => {
supabase.removeChannel(channel);
};
}, [supabase]);

// safety refresh on route change
useEffect(() => {
refresh();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [pathname]);

// sync search param
useEffect(() => {
setQ(searchParams?.get("q") ?? "");
}, [searchParams]);

// ---------- hide on auth pages (NO hook-order break) ----------
const hideOn = new Set([
"/login",
"/signup",
"/forgot-password",
"/reset-password",
]);
const shouldHide = !!pathname && hideOn.has(pathname);

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
color: "rgba(0,0,0,0.92)",
background: "linear-gradient(180deg, #c084fc, #a855f7)",
border: "1px solid rgba(255,255,255,0.35)",
boxShadow:
"0 0 14px rgba(168,85,247,0.85), 0 0 24px rgba(168,85,247,0.45)",
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
transform: "translateY(-1px)",
};

// Notifications dot (placeholder for now)
const notifDotStyle: React.CSSProperties = {
width: 10,
height: 10,
borderRadius: 999,
background: "linear-gradient(180deg, #c084fc, #a855f7)",
border: "1px solid rgba(255,255,255,0.35)",
boxShadow:
"0 0 12px rgba(168,85,247,0.85), 0 0 22px rgba(168,85,247,0.45)",
display: "inline-block",
transform: "translateY(-1px)",
};

const onSubmit = (e: React.FormEvent) => {
e.preventDefault();
const trimmed = q.trim();
router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
};

const badgeText = unread > 99 ? "99+" : String(unread);

// ---------- render ----------
if (shouldHide) return null;

return (
<div
style={{
position: "fixed",
top: 14,
left: "50%",
transform: "translateX(-50%)",
zIndex: 999999,
}}
>
<div
style={{
display: "flex",
alignItems: "center",
gap: 18,
padding: "10px 14px",
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
{unread > 0 && <span style={badgeStyle}>{badgeText}</span>}
</Link>

<Link href="/notifications" style={tabStyle(isActive("/notifications"))}>
Notifications
{/* Placeholder: always shows a dot for now. We'll wire real count later. */}
<span style={notifDotStyle} />
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
</div>
</div>
);
}