import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import TopNav from "./components/TopNav";
import ModerationGate from "./components/ModerationGate";
import { Gloock } from "next/font/google";

const gloock = Gloock({
weight: "400",
subsets: ["latin"],
});

export const metadata: Metadata = {
title: "Unbound",
description: "Unbound",
};

export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
return (
<html lang="en" suppressHydrationWarning>
<body suppressHydrationWarning className={`unbound-bg ${gloock.className}`}>
<Suspense fallback={null}>
<TopNav />
</Suspense>
<ModerationGate />
<main className="app-shell" style={{ paddingTop: 110 }}>
{children}
</main>
</body>
</html>
);
}