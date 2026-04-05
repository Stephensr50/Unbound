import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * USER CLIENT (respects RLS)
 */
function getUserClient(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: req.headers.get("authorization") ?? "",
      },
    },
  });
}

/**
 * ADMIN CLIENT (bypasses RLS)
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscG54Z2JieHh6amtqeGd4a25nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzI5MjIzNCwiZXhwIjoyMDgyODY4MjM0fQ.8duM0yNV1_ccS2E3WnJqFhDgiI3HfUHvyPMocREju9g";

  console.log("SERVICE ROLE PRESENT:", !!serviceKey);
  console.log("SERVICE ROLE PREFIX:", serviceKey?.slice(0, 12));

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  console.log("POST /api/conversations/get-or-create hit");

  const userClient = getUserClient(req);
  const adminClient = getAdminClient();

  const { to } = await req.json().catch(() => ({}));
  if (!to) {
    return NextResponse.json({ error: "Missing 'to'" }, { status: 400 });
  }

  // Who am I?
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  console.log("AUTH USER ID:", user?.id);
  console.log("AUTH ERROR:", authErr?.message ?? null);

  if (!user?.id) {
    return NextResponse.json({ error: "Not authed" }, { status: 401 });
  }

  const me = user.id;

  // 1. Check if conversation already exists
  const { data: mine } = await adminClient
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", me);

  const convIds = (mine ?? []).map((r) => r.conversation_id);

  if (convIds.length > 0) {
    const { data: both } = await adminClient
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", to)
      .in("conversation_id", convIds)
      .limit(1);

    if (both?.[0]) {
      console.log("FOUND EXISTING CONVERSATION:", both[0].conversation_id);
      return NextResponse.json({
        conversation_id: both[0].conversation_id,
      });
    }
  }

  // 2. Create conversation (ADMIN - bypass RLS)
  const { data: conv, error: convErr } = await adminClient
    .from("conversations")
    .insert({})
    .select("id")
    .single();

  console.log("CONV INSERT DATA:", conv);
  console.log("CONV INSERT ERROR:", convErr);

  if (convErr || !conv) {
    return NextResponse.json(
      { error: convErr?.message || "Failed to create conversation" },
      { status: 500 }
    );
  }

  // 3. Insert members (ADMIN - bypass RLS)
  const { error: membersErr } = await adminClient
    .from("conversation_members")
    .upsert([
      { conversation_id: conv.id, user_id: me },
      { conversation_id: conv.id, user_id: to },
    ]);

  console.log("MEMBERS INSERT ERROR:", membersErr);

  if (membersErr) {
    return NextResponse.json(
      { error: membersErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversation_id: conv.id });
}

