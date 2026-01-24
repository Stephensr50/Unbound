import type { Metadata } from "next";
import "./globals.css";
import TopNav from "./components/TopNav";
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
}: Readonly<{
children: React.ReactNode;
}>) {
return (
<html lang="en">
<body className={`unbound-bg ${gloock.className}`}>
<TopNav />
<div style={{ height: 50 }} />
{children}
</body>
</html>
);
}