"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const UNREAD_KEY = "unbound_unread_messages";
const UNREAD_EVENT = "unbound:unread";

export default function TopNav() {
const pathname = usePathname();
const router = useRouter();
const [q, setQ] = useState("");
const [unread, setUnread] = useState(0);

// helper: read unread count
const readUnread = () => {
try {
const raw = localStorage.getItem(UNREAD_KEY);
const n = raw ? Number(raw) : 0;
return Number.isFinite(n) ? n : 0;
} catch {
return 0;
}
};

// keep search input synced if you land on /search?q=...
useEffect(() => {
try {
const url = new URL(window.location.href);
setQ(url.searchParams.get("q") ?? "");
} catch {}
}, [pathname]);

// load unread + subscribe to changes
useEffect(() => {
setUnread(readUnread());

const onCustom = () => setUnread(readUnread());
const onStorage = (e: StorageEvent) => {
if (e.key === UNREAD_KEY) setUnread(readUnread());
};

window.addEventListener(UNREAD_EVENT, onCustom);
window.addEventListener("storage", onStorage);

return () => {
window.removeEventListener(UNREAD_EVENT, onCustom);
window.removeEventListener("storage", onStorage);
};
}, []);

// when you enter messages, clear unread
useEffect(() => {
const onMessagesRoute =
pathname === "/messages" || (pathname ? pathname.startsWith("/messages/") : false);

if (onMessagesRoute) {
try {
localStorage.setItem(UNREAD_KEY, "0");
setUnread(0);
window.dispatchEvent(new Event(UNREAD_EVENT));
} catch {}
}
}, [pathname]);

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
position: "relative",
display: "inline-flex",
alignItems: "center",
gap: 8,
});

const onSubmit = (e: React.FormEvent) => {
e.preventDefault();
const trimmed = q.trim();
router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
};

return (
<div
style={{
position: "fixed",
top: 14,
left: "50%",
transform: "translateX(-50%)",
zIndex: 999999,
pointerEvents: "auto",
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
<div style={{ display: "flex", alignItems: "center", gap: 22 }}>
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
{unread > 0 && (
<span
style={{
minWidth: 18,
height: 18,
padding: "0 6px",
borderRadius: 999,
fontSize: 12,
fontWeight: 900,
lineHeight: "18px",
color: "rgba(0,0,0,0.9)",
background: "rgba(168,85,247,1)",
boxShadow: "0 0 14px rgba(168,85,247,0.85)",
}}
>
{unread > 99 ? "99+" : unread}
</span>
)}
</Link>
</div>

{/* Search pill */}
<form onSubmit={onSubmit} style={{ display: "flex", alignItems: "center" }}>
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
<svg
viewBox="0 0 24 24"
width="18"
height="18"
aria-hidden="true"
style={{ color: "rgba(168,85,247,0.95)" }}
fill="none"
>
<circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
<path
d="M20 20l-3.5-3.5"
stroke="currentColor"
strokeWidth="1.8"
strokeLinecap="round"
/>
</svg>

<input
value={q}
onChange={(e) => setQ(e.target.value)}
placeholder="Search"
autoComplete="off"
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
</div>
</form>
</div>
</div>
);
}