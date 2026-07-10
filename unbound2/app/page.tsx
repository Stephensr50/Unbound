import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HomeAuthRedirect from "./components/HomeAuthRedirect";

export const metadata: Metadata = {
title: "Unbound | BDSM, Kink & Fetish Social Network",
description:
"Join Unbound, an independent 18+ social network for the BDSM, kink, fetish, and alternative lifestyle community.",
alternates: {
canonical: "/",
},
};

const features = [
{
title: "Build Community",
description:
"Meet like-minded adults, follow people who interest you, build friendships, and find your place in the community.",
},
{
title: "Share Your World",
description:
"Post photos, videos, stories, and updates while expressing yourself in a space designed for adults.",
},
{
title: "Creator Friendly",
description:
"Promote your work, grow your audience, and build your personal brand without being treated like an outsider.",
},
{
title: "Privacy Focused",
description:
"Control what you share, connect on your terms, and use tools created with personal boundaries and safety in mind.",
},
];

export default function Home() {
return (
<>
<HomeAuthRedirect />

<div
style={{
width: "100%",
minHeight: "calc(100vh - 110px)",
padding: "24px 16px 56px",
boxSizing: "border-box",
}}
>
<section
style={{
width: "100%",
maxWidth: 1080,
margin: "0 auto",
padding: "52px 24px",
border: "1px solid rgba(220, 70, 255, 0.35)",
borderRadius: 28,
background:
"linear-gradient(145deg, rgba(10, 6, 14, 0.96), rgba(31, 10, 39, 0.9))",
boxShadow:
"0 0 40px rgba(194, 37, 255, 0.16), inset 0 0 30px rgba(255,255,255,0.02)",
textAlign: "center",
}}
>
<Image
src="/unbound-logo1.png"
alt="Unbound BDSM, kink, and fetish social network"
width={220}
height={220}
priority
style={{
width: "min(220px, 58vw)",
height: "auto",
objectFit: "contain",
marginBottom: 18,
filter: "drop-shadow(0 0 24px rgba(223, 54, 255, 0.45))",
}}
/>

<p
style={{
margin: "0 0 10px",
color: "#f067ff",
fontSize: 16,
fontWeight: 700,
letterSpacing: "0.14em",
textTransform: "uppercase",
}}
>
Build Community • Build Your Brand
</p>

<h1
style={{
maxWidth: 850,
margin: "0 auto 20px",
color: "#ffffff",
fontSize: "clamp(38px, 7vw, 72px)",
lineHeight: 1.04,
fontWeight: 400,
}}
>
A social network built for the kink community
</h1>

<p
style={{
maxWidth: 760,
margin: "0 auto",
color: "rgba(255,255,255,0.78)",
fontSize: "clamp(17px, 2.4vw, 21px)",
lineHeight: 1.65,
}}
>
Unbound is an independent 18+ social platform for BDSM, kink,
fetish, creators, and alternative lifestyles. Connect with
like-minded adults, share your world, and express yourself without
having to hide who you are.
</p>

<div
style={{
display: "flex",
justifyContent: "center",
flexWrap: "wrap",
gap: 14,
marginTop: 34,
}}
>
<Link
href="/signup"
style={{
minWidth: 180,
padding: "15px 24px",
borderRadius: 999,
background:
"linear-gradient(135deg, #d528ff 0%, #8f2cff 55%, #fc3d9f 100%)",
color: "#ffffff",
textDecoration: "none",
fontSize: 18,
fontWeight: 800,
boxShadow: "0 0 24px rgba(210, 40, 255, 0.38)",
}}
>
Join Unbound
</Link>

<Link
href="/login"
style={{
minWidth: 180,
padding: "14px 24px",
borderRadius: 999,
border: "1px solid rgba(239, 100, 255, 0.72)",
background: "rgba(255,255,255,0.035)",
color: "#ffffff",
textDecoration: "none",
fontSize: 18,
fontWeight: 800,
}}
>
Log In
</Link>
</div>

<p
style={{
margin: "20px 0 0",
color: "rgba(255,255,255,0.52)",
fontSize: 13,
}}
>
Adults only. You must be 18 or older to join.
</p>
</section>

<section
aria-labelledby="why-unbound"
style={{
width: "100%",
maxWidth: 1080,
margin: "58px auto 0",
}}
>
<h2
id="why-unbound"
style={{
margin: "0 0 12px",
color: "#ffffff",
textAlign: "center",
fontSize: "clamp(30px, 5vw, 48px)",
fontWeight: 400,
}}
>
More than another social app
</h2>

<p
style={{
maxWidth: 700,
margin: "0 auto 30px",
color: "rgba(255,255,255,0.7)",
textAlign: "center",
lineHeight: 1.65,
fontSize: 17,
}}
>
Unbound was created to give adults in the kink and fetish community
a modern place to connect, communicate, discover, and create.
</p>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
gap: 18,
}}
>
{features.map((feature) => (
<article
key={feature.title}
style={{
padding: 24,
borderRadius: 20,
border: "1px solid rgba(201, 68, 255, 0.24)",
background: "rgba(12, 8, 17, 0.88)",
boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
}}
>
<h3
style={{
margin: "0 0 10px",
color: "#f078ff",
fontSize: 22,
fontWeight: 400,
}}
>
{feature.title}
</h3>

<p
style={{
margin: 0,
color: "rgba(255,255,255,0.7)",
fontSize: 16,
lineHeight: 1.65,
}}
>
{feature.description}
</p>
</article>
))}
</div>
</section>

<section
style={{
width: "100%",
maxWidth: 900,
margin: "58px auto 0",
padding: "34px 24px",
borderRadius: 24,
border: "1px solid rgba(210, 62, 255, 0.25)",
background: "rgba(12, 7, 17, 0.9)",
textAlign: "center",
}}
>
<h2
style={{
margin: "0 0 14px",
color: "#ffffff",
fontSize: "clamp(28px, 5vw, 42px)",
fontWeight: 400,
}}
>
A new alternative for adults
</h2>

<p
style={{
maxWidth: 730,
margin: "0 auto",
color: "rgba(255,255,255,0.72)",
fontSize: 17,
lineHeight: 1.7,
}}
>
Whether you are looking for a BDSM social network, a fetish
community, a creator-friendly platform, or simply a place where
alternative lifestyles are welcomed, Unbound gives you room to
connect authentically.
</p>

<Link
href="/signup"
style={{
display: "inline-block",
marginTop: 25,
padding: "14px 26px",
borderRadius: 999,
background:
"linear-gradient(135deg, #d528ff, #9a2bff, #f23f9d)",
color: "#ffffff",
textDecoration: "none",
fontSize: 17,
fontWeight: 800,
boxShadow: "0 0 22px rgba(210, 40, 255, 0.32)",
}}
>
Create Your Account
</Link>
</section>

<footer
style={{
maxWidth: 1080,
margin: "42px auto 0",
paddingTop: 22,
borderTop: "1px solid rgba(255,255,255,0.1)",
color: "rgba(255,255,255,0.48)",
textAlign: "center",
fontSize: 13,
lineHeight: 1.7,
}}
>
<p style={{ margin: 0 }}>
© {new Date().getFullYear()} Unbound Social LLC. Unbound is an
adults-only social platform.
</p>

<div
style={{
display: "flex",
justifyContent: "center",
flexWrap: "wrap",
gap: 18,
marginTop: 10,
}}
>
<Link href="/terms" style={{ color: "inherit" }}>
Terms
</Link>

<Link href="/privacy" style={{ color: "inherit" }}>
Privacy
</Link>

<Link href="/community-guidelines" style={{ color: "inherit" }}>
Community Guidelines
</Link>

<Link href="/2257" style={{ color: "inherit" }}>
2257 Notice
</Link>

<Link href="/contact" style={{ color: "inherit" }}>
Contact
</Link>
</div>
</footer>
</div>
</>
);
}