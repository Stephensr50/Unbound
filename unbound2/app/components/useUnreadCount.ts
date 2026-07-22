"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type ReadRow = {
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

const [unread, setUnread] = useState<number>(0);

const inFlightRef = useRef(false);
const uidRef = useRef<string | null>(null);
const lastRunAtRef = useRef(0);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
uidRef.current = uid;
return uid;
}

async function calcUnread(uid: string) {
// 1) conversations I'm in
const { data: myMemberships, error: memErr } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", uid);

if (memErr) throw memErr;

const convIds = (myMemberships ?? []).map((m: any) => m.conversation_id);
if (convIds.length === 0) {
setUnread(0);
return;
}

// 2) read pointers
const { data: reads, error: readsErr } = await supabase
.from("conversation_reads")
.select("conversation_id,user_id,last_read_message_id")
.eq("user_id", uid)
.in("conversation_id", convIds);

if (readsErr) throw readsErr;

const lastReadByConv = new Map<number, number>();
(reads as ReadRow[] | null)?.forEach((r) => {
lastReadByConv.set(r.conversation_id, r.last_read_message_id ?? 0);
});

// 3) count unread messages
let total = 0;

for (const convId of convIds) {
const lastRead = lastReadByConv.get(convId) ?? 0;

const { count, error: msgErr } = await supabase
.from("messages")
.select("id", { count: "exact", head: true })
.eq("conversation_id", convId)
.gt("id", lastRead)
.neq("sender_id", uid);

if (msgErr) throw msgErr;
total += count ?? 0;
}

setUnread(total);
}

async function refresh() {
// throttle a bit so we don’t jitter/fight renders
const now = Date.now();
if (now - lastRunAtRef.current < 1000) return;
lastRunAtRef.current = now;

if (inFlightRef.current) return;
inFlightRef.current = true;

try {
const uid = uidRef.current ?? (await refreshAuth());

// IMPORTANT: if not authed, keep badge honest
if (!uid) {
setUnread(0);
return;
}

await calcUnread(uid);
} catch {
// ignore
} finally {
inFlightRef.current = false;
}
}

useEffect(() => {
// keep uidRef in sync when login/logout happens
const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
uidRef.current = session?.user?.id ?? null;
// refresh immediately on any auth change
refresh();
});

// initial
refresh();

// poll every 60 seconds
const t = window.setInterval(() => {
if (document.visibilityState === "visible") refresh();
}, 60000);

const onFocus = () => refresh();
const onVis = () => {
if (document.visibilityState === "visible") refresh();
};

window.addEventListener("focus", onFocus);
document.addEventListener("visibilitychange", onVis);

return () => {
sub.subscription.unsubscribe();
window.clearInterval(t);
window.removeEventListener("focus", onFocus);
document.removeEventListener("visibilitychange", onVis);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

return { unread, refresh, supabase };
}