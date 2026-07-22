"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type CMRow = {
conversation_id: number;
user_id: string;
last_read_message_id: number | null;
};

export function useUnreadCount() {
const supabase = useMemo(() => {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
return createClient(url, key);
}, []);

const [myUserId, setMyUserId] = useState<string | null>(null);
const [unread, setUnread] = useState<number>(0);

const inFlightRef = useRef(false);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function calcUnread(uid: string) {
if (inFlightRef.current) return;
inFlightRef.current = true;

try {
// 1) Get my membership rows (with last_read_message_id)
const { data: cm, error: cmErr } = await supabase
.from("conversation_members")
.select("conversation_id,user_id,last_read_message_id")
.eq("user_id", uid);

if (cmErr) throw cmErr;

const rows = (cm ?? []) as CMRow[];
if (rows.length === 0) {
setUnread(0);
return;
}

// 2) For each conversation, count messages newer than my last read,
// excluding messages I sent.
let total = 0;

for (const r of rows) {
const last = r.last_read_message_id ?? 0;

const { count, error: msgErr } = await supabase
.from("messages")
.select("id", { count: "exact", head: true })
.eq("conversation_id", r.conversation_id)
.gt("id", last)
.neq("sender_id", uid);

if (msgErr) throw msgErr;
total += count ?? 0;
}

setUnread(total);
} catch (e) {
// If something is off with RLS, table names, etc, you’ll see it in console
console.error("useUnreadCount error:", e);
} finally {
inFlightRef.current = false;
}
}

useEffect(() => {
let alive = true;

(async () => {
const uid = await refreshAuth();
if (!alive || !uid) return;

await calcUnread(uid);

// refresh periodically (simple + stable)
const interval = window.setInterval(() => {
if (!myUserId) return;
calcUnread(myUserId);
}, 60000);

// refresh when tab becomes visible again
const onVis = () => {
if (document.visibilityState === "visible" && myUserId) {
calcUnread(myUserId);
}
};
document.addEventListener("visibilitychange", onVis);

return () => {
window.clearInterval(interval);
document.removeEventListener("visibilitychange", onVis);
};
})();

return () => {
alive = false;
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [supabase]);

return { unread, myUserId, refresh: () => (myUserId ? calcUnread(myUserId) : null) };
}