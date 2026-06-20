import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import TopNav from "./components/TopNav";
import ModerationGate from "./components/ModerationGate";
import AgeGate from "./components/AgeGate";
import { Gloock } from "next/font/google";

export const dynamic = "force-dynamic";

export const viewport = {
width: "device-width",
initialScale: 1,
};

const gloock = Gloock({
weight: "400",
subsets: ["latin"],
});

export const metadata: Metadata = {
title: "Unbound",
description: "Unbound",
icons: {
apple: "/apple-touch-icon.png",
},
verification: {
google: "XngmY73g4KwXjhuX0mcQYjjuc_2b3HU4DXsxrHd1XnA",
},
};

export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
return (
<html lang="en" suppressHydrationWarning>
<body
suppressHydrationWarning
className={`unbound-bg ${gloock.className}`}
>
<AgeGate>
<Suspense fallback={null}>
<TopNav />
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