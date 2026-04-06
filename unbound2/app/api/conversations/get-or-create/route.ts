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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  const userClient = getUserClient(req);
  const adminClient = getAdminClient();

  const { to } = await req.json().catch(() => ({}));

  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "Missing 'to'" }, { status: 400 });
  }

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user?.id) {
    return NextResponse.json({ error: "Not authed" }, { status: 401 });
  }

  const me = user.id;

  if (me === to) {
    return NextResponse.json(
      { error: "Cannot create a conversation with yourself" },
      { status: 400 }
    );
  }

  const { data: myMemberships, error: myErr } = await adminClient
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", me);

  if (myErr) {
    return NextResponse.json({ error: myErr.message }, { status: 500 });
  }

  const myConversationIds = (myMemberships ?? [])
    .map((row) => row.conversation_id)
    .filter(Boolean);

  if (myConversationIds.length > 0) {
    const { data: sharedMemberships, error: sharedErr } = await adminClient
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", to)
      .in("conversation_id", myConversationIds)
      .order("conversation_id", { ascending: true });

    if (sharedErr) {
      return NextResponse.json({ error: sharedErr.message }, { status: 500 });
    }

    const existingConversationId = sharedMemberships?.[0]?.conversation_id;

    if (existingConversationId) {
      return NextResponse.json({
        conversation_id: existingConversationId,
      });
    }
  }

  const { data: conv, error: convErr } = await adminClient
    .from("conversations")
    .insert({})
    .select("id")
    .single();

  if (convErr || !conv) {
    return NextResponse.json(
      { error: convErr?.message || "Failed to create conversation" },
      { status: 500 }
    );
  }

  const { error: membersErr } = await adminClient
    .from("conversation_members")
    .upsert(
      [
        { conversation_id: conv.id, user_id: me },
        { conversation_id: conv.id, user_id: to },
      ],
      {
        onConflict: "conversation_id,user_id",
      }
    );

  if (membersErr) {
    return NextResponse.json(
      { error: membersErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversation_id: conv.id });
}
