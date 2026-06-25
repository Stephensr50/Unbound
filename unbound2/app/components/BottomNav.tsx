"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function BottomNav() {
const pathname = usePathname();
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
const check = () => setIsMobile(window.innerWidth <= 900);
check();
window.addEventListener("resize", check);
return () => window.removeEventListener("resize", check);
}, []);

if (!isMobile) return null;

const active = "#ff4fd8";
const inactive = "rgba(255,255,255,0.72)";

const itemStyle = (isActive: boolean): React.CSSProperties => ({
color: isActive ? active : inactive,
textDecoration: "none",
display: "grid",
placeItems: "center",
gap: 3,
fontSize: 11,
fontFamily: "Arial, sans-serif",
});

const iconStyle: React.CSSProperties = {
width: 24,
height: 24,
};

return (
<nav
style={{
position: "fixed",
left: 0,
right: 0,
bottom: 0,
height: 72,
zIndex: 9999,
display: "grid",
gridTemplateColumns: "repeat(5, 1fr)",
alignItems: "center",
background: "rgba(5,0,10,0.94)",
backdropFilter: "blur(16px)",
borderTop: "1px solid rgba(255,255,255,0.12)",
paddingBottom: "env(safe-area-inset-bottom)",
}}
>
<Link href="/feed" style={itemStyle(pathname === "/feed")}>
<svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
<path d="M12 3 3 10.5h2V21h5v-6h4v6h5V10.5h2L12 3z" />
</svg>
Feed
</Link>

<Link href="/explore" style={itemStyle(pathname === "/explore")}>
<svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
<path d="M10.5 4a6.5 6.5 0 0 1 5.15 10.46l4.45 4.44-1.4 1.4-4.44-4.45A6.5 6.5 0 1 1 10.5 4zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
</svg>
Explore
</Link>

<Link href="/feed" style={itemStyle(false)}>
<span
style={{
width: 52,
height: 52,
borderRadius: "50%",
background: "rgba(255,79,216,.18)",
border: "2px solid #ff4fd8",
display: "grid",
placeItems: "center",
color: "#ff4fd8",
fontSize: 36,
fontWeight: 700,
lineHeight: 1,
boxShadow: "0 0 18px rgba(255,79,216,.35)",
}}
>
+
</span>
</Link>

<Link href="/reels" style={itemStyle(pathname === "/reels")}>
<svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13zm6 3.2v6.6l5.4-3.3L10 8.7z" />
</svg>
Reels
</Link>

<Link href="/profile" style={itemStyle(pathname === "/profile")}>
<svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle}>
<path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />
</svg>
Profile
</Link>
</nav>
);
}