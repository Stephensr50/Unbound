"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ConversationRow = {
id: string;
last_message_at: string | null;
messages: {
body: string;
created_at: string;
}[];
};

export default function MessagesInbox() {
const [threads, setThreads] = useState<ConversationRow[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
async function loadInbox() {
setLoading(true);

const { data, error } = await supabase
.from("conversations")
.select(`
id,
last_message_at,
messages (
body,
created_at
)
`)
.order("last_message_at", { ascending: false });

if (error) {
console.error("Inbox load error:", error);
} else {
setThreads(data ?? []);
}

setLoading(false);
}

loadInbox();
}, []);

if (loading) {
return <div className="p-4 text-gray-400">Loading messages…</div>;
}

if (!threads.length) {
return <div className="p-4 text-gray-400">No conversations yet</div>;
}

return (
<div className="flex flex-col gap-3 p-4">
{threads.map((thread) => {
const last = thread.messages?.[0];

return (
<Link
key={thread.id}
href={`/messages/${thread.id}`}
className="rounded-lg border border-white/10 p-3 hover:bg-white/5 transition"
>
<div className="text-sm text-white">
{last?.body ?? "New conversation"}
</div>

<div className="text-xs text-gray-400 mt-1">
{last
? new Date(last.created_at).toLocaleString()
: ""}
</div>
</Link>
);
})}
</div>
);
}