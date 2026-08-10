import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
title: "FetLife Alternative | BDSM & Kink Social Network",
description:
"Looking for a FetLife alternative? Unbound is an independent 18+ social network for BDSM, kink, fetish, creators, and alternative lifestyles. Connect, share, discover, and build community.",
keywords: [
"FetLife alternative",
"alternative to FetLife",
"BDSM social network",
"kink social network",
"kink community",
"fetish community",
"BDSM community",
"adult social network",
"kink social media",
"Unbound",
],
alternates: {
canonical: "/fetlife-alternative",
},
openGraph: {
title: "FetLife Alternative | Unbound",
description:
"Discover Unbound, an independent 18+ BDSM, kink, and fetish social network built for connection, expression, and community.",
url: "/fetlife-alternative",
type: "website",
images: ["/unbound-og.png"],
},
twitter: {
card: "summary_large_image",
title: "FetLife Alternative | Unbound",
description:
"An independent 18+ social network for BDSM, kink, fetish, creators, and alternative lifestyles.",
images: ["/unbound-og.png"],
},
};

const pageStyle: React.CSSProperties = {
width: "100%",
maxWidth: 980,
margin: "0 auto",
padding: "32px 20px 80px",
};

const heroStyle: React.CSSProperties = {
padding: "54px 26px",
borderRadius: 24,
border: "1px solid rgba(236, 72, 255, 0.28)",
background:
"linear-gradient(145deg, rgba(16, 10, 22, 0.92), rgba(39, 12, 47, 0.82))",
boxShadow:
"0 0 40px rgba(210, 55, 255, 0.10), inset 0 0 40px rgba(255,255,255,0.015)",
textAlign: "center",
};

const sectionStyle: React.CSSProperties = {
marginTop: 28,
padding: "30px 26px",
borderRadius: 22,
border: "1px solid rgba(190, 120, 255, 0.16)",
background: "rgba(10, 8, 14, 0.84)",
backdropFilter: "blur(10px)",
};

const headingStyle: React.CSSProperties = {
margin: "0 0 16px",
fontSize: "clamp(28px, 5vw, 46px)",
lineHeight: 1.08,
};

const h2Style: React.CSSProperties = {
margin: "0 0 14px",
fontSize: "clamp(23px, 4vw, 31px)",
};

const paragraphStyle: React.CSSProperties = {
fontFamily:
'Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
fontSize: 17,
lineHeight: 1.75,
color: "rgba(255,255,255,0.84)",
margin: "0 0 16px",
};

const buttonRowStyle: React.CSSProperties = {
display: "flex",
flexWrap: "wrap",
justifyContent: "center",
gap: 12,
marginTop: 28,
};

const primaryButtonStyle: React.CSSProperties = {
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
minHeight: 48,
padding: "0 24px",
borderRadius: 999,
textDecoration: "none",
color: "#fff",
fontWeight: 800,
fontFamily:
'Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
background:
"linear-gradient(90deg, rgba(255,65,190,1), rgba(145,80,255,1))",
boxShadow: "0 0 22px rgba(224, 68, 255, 0.24)",
};

const secondaryButtonStyle: React.CSSProperties = {
...primaryButtonStyle,
background: "rgba(255,255,255,0.06)",
border: "1px solid rgba(255,255,255,0.16)",
boxShadow: "none",
};

const featureGridStyle: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 14,
marginTop: 20,
};

const featureStyle: React.CSSProperties = {
padding: 20,
borderRadius: 18,
border: "1px solid rgba(220, 100, 255, 0.14)",
background: "rgba(255,255,255,0.035)",
};

export default function FetLifeAlternativePage() {
return (
<div style={pageStyle}>
<section style={heroStyle}>
<div
style={{
fontFamily:
'Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
fontSize: 13,
fontWeight: 800,
letterSpacing: "0.12em",
textTransform: "uppercase",
color: "#ff70dc",
marginBottom: 14,
}}
>
18+ BDSM • Kink • Fetish Community
</div>

<h1 style={headingStyle}>
Looking for a FetLife Alternative?
</h1>

<p
style={{
...paragraphStyle,
maxWidth: 760,
margin: "0 auto",
fontSize: 18,
}}
>
Unbound is an independent social network for adults interested in
BDSM, kink, fetish, creators, and alternative lifestyles. Meet
like-minded people, share your world, discover new connections, and
be part of a growing community built around self-expression.
</p>

<div style={buttonRowStyle}>
<Link href="/signup" style={primaryButtonStyle}>
Join Unbound
</Link>

<Link href="/login" style={secondaryButtonStyle}>
Sign In
</Link>
</div>
</section>

<section style={sectionStyle}>
<h2 style={h2Style}>A New Place for the Kink Community</h2>

<p style={paragraphStyle}>
People searching for an alternative to FetLife are often looking for
another way to connect with the BDSM and kink community online.
Unbound was created as an independent 18+ social platform where
members can build profiles, share content, follow people they enjoy,
discover creators, and interact with other adults who share similar
interests.
</p>

<p style={paragraphStyle}>
Unbound is not affiliated with FetLife. It is its own social network
with its own community, features, identity, and direction.
</p>
</section>

<section style={sectionStyle}>
<h2 style={h2Style}>What You Can Do on Unbound</h2>

<div style={featureGridStyle}>
<div style={featureStyle}>
<h3 style={{ marginTop: 0 }}>Create Your Profile</h3>
<p style={{ ...paragraphStyle, fontSize: 16, marginBottom: 0 }}>
Express who you are, what you are interested in, and what kinds
of connections you are looking for.
</p>
</div>

<div style={featureStyle}>
<h3 style={{ marginTop: 0 }}>Share Posts & Photos</h3>
<p style={{ ...paragraphStyle, fontSize: 16, marginBottom: 0 }}>
Post updates, photos, videos, and other content to your profile
and the community feed.
</p>
</div>

<div style={featureStyle}>
<h3 style={{ marginTop: 0 }}>Stories & Reels</h3>
<p style={{ ...paragraphStyle, fontSize: 16, marginBottom: 0 }}>
Share quick moments through Stories or discover short-form video
through Reels.
</p>
</div>

<div style={featureStyle}>
<h3 style={{ marginTop: 0 }}>Discover People</h3>
<p style={{ ...paragraphStyle, fontSize: 16, marginBottom: 0 }}>
Explore profiles and discover adults with shared interests,
identities, lifestyles, and communities.
</p>
</div>

<div style={featureStyle}>
<h3 style={{ marginTop: 0 }}>Private Messaging</h3>
<p style={{ ...paragraphStyle, fontSize: 16, marginBottom: 0 }}>
Connect directly with other members through private
conversations.
</p>
</div>

<div style={featureStyle}>
<h3 style={{ marginTop: 0 }}>Community & Connection</h3>
<p style={{ ...paragraphStyle, fontSize: 16, marginBottom: 0 }}>
Follow people, make connections, interact with posts, and become
part of a growing social community.
</p>
</div>
</div>
</section>

<section style={sectionStyle}>
<h2 style={h2Style}>More Than a Dating App</h2>

<p style={paragraphStyle}>
Unbound is designed as a social network rather than simply a dating
app. Some members may be interested in dating or meeting people,
while others are here for friendship, community, conversation,
content, education, creativity, or simply having a place where their
interests do not have to be hidden.
</p>

<p style={paragraphStyle}>
The goal is to give adults in the BDSM, kink, fetish, and alternative
lifestyle communities another place to connect and express
themselves online.
</p>
</section>

<section style={sectionStyle}>
<h2 style={h2Style}>Built for Adults, Community, and Expression</h2>

<p style={paragraphStyle}>
Unbound is an 18+ platform. Members are expected to follow the
community guidelines, respect boundaries, respect consent, and treat
other members like people.
</p>

<p style={paragraphStyle}>
As the community grows, Unbound will continue developing new ways for
members and creators to connect, share, discover, and participate.
</p>

<div style={buttonRowStyle}>
<Link href="/signup" style={primaryButtonStyle}>
Create Your Unbound Profile
</Link>

<Link href="/community-guidelines" style={secondaryButtonStyle}>
Community Guidelines
</Link>
</div>
</section>

<section
style={{
marginTop: 28,
padding: "28px 20px",
textAlign: "center",
}}
>
<p
style={{
...paragraphStyle,
fontSize: 14,
color: "rgba(255,255,255,0.52)",
marginBottom: 0,
}}
>
Unbound is an independent platform and is not affiliated with,
endorsed by, or sponsored by FetLife.
</p>
</section>
</div>
);
}