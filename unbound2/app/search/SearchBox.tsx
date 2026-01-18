"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SearchBoxProps = {
initialValue?: string;
};

export default function SearchBox({ initialValue = "" }: SearchBoxProps) {
const router = useRouter();
const [value, setValue] = useState(initialValue);

function onSubmit(e: React.FormEvent) {
e.preventDefault();

const q = value.trim();
if (!q) return;

router.push(`/search?q=${encodeURIComponent(q)}`);
}

return (
<form onSubmit={onSubmit}>
<input
value={value}
onChange={(e) => setValue(e.target.value)}
placeholder="Search..."
style={{
width: "100%",
padding: "12px 14px",
borderRadius: 10,
background: "#111",
color: "#fff",
border: "1px solid #333",
fontSize: 16,
}}
/>
</form>
);
}