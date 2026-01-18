"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TopNav() {
const pathname = usePathname();
const router = useRouter();
const [q, setQ] = useState("");

useEffect(() => {
// keep search input synced if you land on /search?q=...
try {
const url = new URL(window.location.href);
setQ(url.searchParams.get("q") ?? "");
} catch {}
}, [pathname]);

const isActive = (href: string) => {
if (!pathname) return false;
if (href === "/feed") return pathname === "/feed" || pathname === "/";
return pathname === href || pathname.startsWith(href + "/");
};

const tabStyle = (active: boolean): React.CSSProperties => ({
fontFamily: "inherit",
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
{/* Center pill */}
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
{/* Tabs (centered, spaced) */}
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
</div>

{/* Search pill (purple, NOT white, NOT rectangle) */}
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
{/* Outline magnifier icon (no fill) */}
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
}}
/>
</div>
</form>
</div>
</div>
);
}