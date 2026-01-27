"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import MessagesInbox from "./MessagesInbox";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars");
return createClient(url, key);
}

export default function MessagesPage() {
const router = useRouter();
const params = useSearchParams();
const to = params.get("to");

useEffect(() => {
let cancelled = false;

async function go() {
if (!to) return;

const supabase = getSupabase();

// logged-in user
const { data: userData } = await supabase.auth.getUser();
const me = userData?.user?.id;

if (!me) {
console.log("Not logged in — cannot create conversation");
return;
}

// find existing convo between me and to
const { data: myMemberships, error: memErr } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", me);

if (memErr) {
console.log("membership error:", memErr.message);
return;
}

const convIds = (myMemberships ?? []).map((m: any) => m.conversation_id);

let existingId: string | null = null;

if (convIds.length > 0) {
const { data: otherMembership, error: otherErr } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", to)
.in("conversation_id", convIds);

if (otherErr) {
console.log("other membership error:", otherErr.message);
return;
}

existingId = otherMembership?.[0]?.conversation_id ?? null;
}

if (existingId) {
if (!cancelled) router.replace(`/messages/${existingId}`);
return;
}

// create new convo
const { data: conv, error: convErr } = await supabase
.from("conversations")
.insert({})
.select("id")
.single();

if (convErr || !conv?.id) {
console.log("create conversation error:", convErr?.message);
return;
}

const conversationId = conv.id;

// add members
const { error: addErr } = await supabase.from("conversation_members").insert([
{ conversation_id: conversationId, user_id: me },
{ conversation_id: conversationId, user_id: to },
]);

if (addErr) {
console.log("add members error:", addErr.message);
return;
}

if (!cancelled) router.replace(`/messages/${conversationId}`);
}

go();

return () => {
cancelled = true;
};
}, [to, router]);

return <MessagesInbox />;
}