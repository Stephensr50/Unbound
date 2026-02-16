"use client";

import dynamic from "next/dynamic";

const ThreadView = dynamic(() => import("../ThreadView"), {
ssr: false,
});

export default function Page() {
return <ThreadView />;
}