import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Gloock } from "next/font/google";

import "./globals.css";
import TopNav from "./components/TopNav";
import BottomNav from "./components/BottomNav";
import ModerationGate from "./components/ModerationGate";
import AgeGate from "./components/AgeGate";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
width: "device-width",
initialScale: 1,
};

const gloock = Gloock({
weight: "400",
subsets: ["latin"],
});

export const metadata: Metadata = {
metadataBase: new URL("https://yourunbound.com"),

title: {
default: "Unbound | BDSM, Kink & Fetish Social Network",
template: "%s | Unbound",
},

description:
"Unbound is an 18+ social network for the BDSM, kink, and fetish community. Connect with like-minded adults, share content, discover creators, and express yourself freely.",

applicationName: "Unbound",

keywords: [
"Unbound",
"BDSM social network",
"kink social network",
"fetish community",
"adult social network",
"BDSM community",
"kink community",
"FetLife alternative",
"fetish social media",
"adult creator platform",
],

authors: [
{
name: "Unbound Social LLC",
url: "https://yourunbound.com",
},
],

creator: "Unbound Social LLC",
publisher: "Unbound Social LLC",

alternates: {
canonical: "/",
},

openGraph: {
type: "website",
locale: "en_US",
url: "/",
siteName: "Unbound",
title: "Unbound | BDSM, Kink & Fetish Social Network",
description:
"Join Unbound, an 18+ social network for the BDSM, kink, and fetish community. Connect, share, discover creators, and express yourself freely.",
images: [
{
url: "/unbound-og.png",
width: 1200,
height: 630,
alt: "Unbound — Build Community, Build Your Brand",
},
],
},

twitter: {
card: "summary_large_image",
title: "Unbound | BDSM, Kink & Fetish Social Network",
description:
"An 18+ social network built for the BDSM, kink, and fetish community.",
images: ["/unbound-og.png"],
},

robots: {
index: true,
follow: true,
googleBot: {
index: true,
follow: true,
"max-image-preview": "large",
"max-snippet": -1,
"max-video-preview": -1,
},
},

category: "social networking",

manifest: "/manifest.json",

icons: {
icon: "/apple-touch-icon2.png",
apple: "/apple-touch-icon2.png",
},

verification: {
google: "XngmY73g4KWXjhuX0mcQYjjuc_2b3HU4DXsxrHd1XnA",
},
};

const organizationSchema = {
"@context": "https://schema.org",
"@type": "Organization",
name: "Unbound",
legalName: "Unbound Social LLC",
url: "https://yourunbound.com",
logo: "https://yourunbound.com/apple-touch-icon2.png",
description:
"Unbound is an 18+ social network for the BDSM, kink, and fetish community.",
};

const websiteSchema = {
"@context": "https://schema.org",
"@type": "WebSite",
name: "Unbound",
url: "https://yourunbound.com",
description:
"An 18+ social network for the BDSM, kink, and fetish community.",
};

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode;
}>) {
return (
<html lang="en" suppressHydrationWarning>
<body
suppressHydrationWarning
className={`unbound-bg ${gloock.className}`}
>
<script
type="application/ld+json"
dangerouslySetInnerHTML={{
__html: JSON.stringify(organizationSchema).replace(/</g, "\\u003c"),
}}
/>

<script
type="application/ld+json"
dangerouslySetInnerHTML={{
__html: JSON.stringify(websiteSchema).replace(/</g, "\\u003c"),
}}
/>

<AgeGate>
<Suspense fallback={null}>
<TopNav />
<BottomNav />
</Suspense>

<ModerationGate />

<main className="app-shell" style={{ paddingTop: 110 }}>
{children}
</main>
</AgeGate>
</body>
</html>
);
}