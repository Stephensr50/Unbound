import type { Metadata } from "next";
import "./globals.css";

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
<body className="unbound-bg">{children}</body>
</html>
);
}