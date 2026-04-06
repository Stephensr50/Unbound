import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

type MessageRow = {
  id: number;
  body: string | null;
  created_at: string;
  sender_id: string | null;
  conversation_id: number;
};

type MemberRow = {
  conversation_id: number;
  user_id: string;
  hidden_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export async function GET(req: Request) {
  const userClient = getUserClient(req);
  const adminClient = getAdminClient();

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user?.id) {
    return NextResponse.json({ error: "Not authed" }, { status: 401 });
  }

  const me = user.id;

  const { data: myMemberships, error: membershipErr } = await adminClient
    .from("conversation_members")
    .select("conversation_id, user_id, hidden_at")
    .eq("user_id", me)
    .is("hidden_at", null);

  if (membershipErr) {
    return NextResponse.json({ error: membershipErr.message }, { status: 500 });
  }

  const conversationIds = (myMemberships ?? []).map((r) => r.conversation_id);

  if (conversationIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: allMembers, error: allMembersErr } = await adminClient
    .from("conversation_members")
    .select("conversation_id, user_id, hidden_at")
    .in("conversation_id", conversationIds);

  if (allMembersErr) {
    return NextResponse.json({ error: allMembersErr.message }, { status: 500 });
  }

  const { data: allMessages, error: messagesErr } = await adminClient
    .from("messages")
    .select("id, body, created_at, sender_id, conversation_id")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  if (messagesErr) {
    return NextResponse.json({ error: messagesErr.message }, { status: 500 });
  }

  const latestByConversation = new Map<number, MessageRow>();
  for (const msg of (allMessages ?? []) as MessageRow[]) {
    if (!latestByConversation.has(msg.conversation_id)) {
      latestByConversation.set(msg.conversation_id, msg);
    }
  }

  const membersByConversation = new Map<number, MemberRow[]>();
  for (const row of (allMembers ?? []) as MemberRow[]) {
    if (!membersByConversation.has(row.conversation_id)) {
      membersByConversation.set(row.conversation_id, []);
    }
    membersByConversation.get(row.conversation_id)!.push(row);
  }

  const otherUserIds = Array.from(
    new Set(
      ((allMembers ?? []) as MemberRow[])
        .filter((m) => m.user_id !== me)
        .map((m) => m.user_id)
    )
  );

  let profilesById = new Map<string, ProfileRow>();
  if (otherUserIds.length > 0) {
    const { data: profiles, error: profilesErr } = await adminClient
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", otherUserIds);

    if (profilesErr) {
      return NextResponse.json({ error: profilesErr.message }, { status: 500 });
    }

    profilesById = new Map(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p])
    );
  }

  const items = conversationIds
    .map((conversationId) => {
      const members = membersByConversation.get(conversationId) ?? [];
      const otherMember = members.find((m) => m.user_id !== me) ?? null;
      const otherProfile = otherMember
        ? profilesById.get(otherMember.user_id) ?? null
        : null;
      const latest = latestByConversation.get(conversationId) ?? null;

      return {
        id: conversationId,
        other_user: otherProfile
          ? {
              id: otherProfile.id,
              username: otherProfile.username,
              display_name: otherProfile.display_name,
              avatar_url: otherProfile.avatar_url,
            }
          : null,
        preview: latest?.body ?? "",
        last_message_at: latest?.created_at ?? null,
      };
    })
    .sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });

  return NextResponse.json({ items });
}
