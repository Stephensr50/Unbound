"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchBox from "./SearchBox";

export default function SearchPage() {
const sp = useSearchParams();

// read q from the URL
const urlQ = sp.get("q") ?? "";

// keep a state copy that updates whenever the URL changes
const [q, setQ] = useState(urlQ);

useEffect(() => {
setQ(urlQ);
}, [urlQ]);

return (
<div style={{ padding: 24 }}>
<h1>Search</h1>

{/* key forces the SearchBox to re-mount when q changes */}
<div style={{ maxWidth: 640 }}>
<SearchBox key={q} initialValue={q} />
</div>

<p style={{ marginTop: 16 }}>
Query value: <strong>{q || "(empty)"}</strong>
</p>

<p style={{ marginTop: 24, opacity: 0.8 }}>
Results placeholder — we&apos;ll wire real results next.
</p>
</div>
);
}