"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const QUESTIONS = [
  "Would you let them tie you up?",
  "Would you let them take control?",
  "Would you let them fuck you all night?",
  "Would you let them tell you what to do?",
  "Would you let them tease you in public?",
  "Would you let them be your guilty pleasure?",
  "Would you let them boss you around?",
  "Would you let them ruin your focus?",
  "Would you let them spank your ass?"
];

export default function GamePage() {
  const supabase = useMemo(() => getSupabase(), []);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [current, setCurrent] = useState<Profile | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [matchProfile, setMatchProfile] = useState<Profile | null>(null);

  function getRandomQuestion() {
    return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  }

  function pickNext(list: Profile[]) {
    if (!list.length) return;
    const next = list[Math.floor(Math.random() * list.length)];
    setCurrent(next);
    setQuestion(getRandomQuestion());
  }

  async function loadProfiles() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .not("id", "is", null)
      .limit(50);

    if (!error && data) {
      setProfiles(data);
      pickNext(data);
    }

    setLoading(false);
  }

  function nextProfile() {
    pickNext(profiles);
  }

  async function handleAnswer(answer: "yes" | "no") {
    const { data } = await supabase.auth.getUser();
    const me = data.user?.id;

    if (!me) {
      alert("You need to be logged in to play.");
      return;
    }

    if (!current?.id || me === current.id) {
      nextProfile();
      return;
    }

    const { error: voteErr } = await supabase.from("game_votes").upsert(
      {
        from_user: me,
        to_user: current.id,
        answer,
      },
      {
        onConflict: "from_user,to_user",
      }
    );

    if (voteErr) {
      console.error(voteErr);
      nextProfile();
      return;
    }

    if (answer === "yes") {
      const { data: reverseYes, error: reverseErr } = await supabase
        .from("game_votes")
        .select("id")
        .eq("from_user", current.id)
        .eq("to_user", me)
        .eq("answer", "yes")
        .maybeSingle();

      if (!reverseErr && reverseYes) {
        await supabase.from("notifications").insert({
          user_id: current.id,
          actor_id: me,
          type: "game_match",
          message: "You have a match 🔥",
          href: `/u/${me}`,
        });

        await supabase.from("notifications").insert({
          user_id: me,
          actor_id: current.id,
          type: "game_match",
          message: "You have a match 🔥",
          href: `/u/${current.id}`,
        });

        setMatchProfile(current);
        return;
      }
    }

    nextProfile();
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  if (loading || !current) {
    return <div style={{ padding: 20, color: "#fff" }}>Loading game…</div>;
  }

  const name = current.display_name || current.username || "Unknown";

  return (
    <>
      <div
        style={{
          padding: 20,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <img
          src={current.avatar_url || "/rope-devil.png"}
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            objectFit: "cover",
            boxShadow: "0 0 20px rgba(170,90,255,0.6)",
          }}
        />

        <div style={{ fontSize: 22, fontWeight: 700 }}>{name}</div>

        <div style={{ fontSize: 18, opacity: 0.9 }}>{question}</div>

        <div style={{ display: "flex", gap: 16 }}>
          <button
            onClick={() => handleAnswer("yes")}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(180deg,#22c55e,#166534)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            YES 😈
          </button>

          <button
            onClick={() => handleAnswer("no")}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(180deg,#ef4444,#7f1d1d)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            NO 🙅‍♂️
          </button>
        </div>
      </div>

      {matchProfile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 24,
              padding: 28,
              textAlign: "center",
              background:
                "linear-gradient(180deg, rgba(168,85,247,0.22), rgba(20,20,20,0.96))",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 0 40px rgba(168,85,247,0.45)",
              color: "#fff",
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: "#ff66cc",
                textShadow: "0 0 18px rgba(255,102,204,0.55)",
                marginBottom: 18,
              }}
            >
              It’s a Match 💥
            </div>

            <img
              src={matchProfile.avatar_url || "/rope-devil.png"}
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: 16,
                boxShadow: "0 0 24px rgba(255,102,204,0.45)",
              }}
            />

            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              {matchProfile.display_name || matchProfile.username || "Unknown"}
            </div>

            <div
              style={{
                fontSize: 16,
                opacity: 0.9,
                marginBottom: 22,
              }}
            >
              You both said yes 😈
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => {
                  setMatchProfile(null);
                  nextProfile();
                }}
                style={{
                  padding: "12px 18px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(180deg,#a855f7,#6d28d9)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 0 16px rgba(168,85,247,0.35)",
                }}
              >
                Keep Playing
              </button>

              <button
                onClick={() => {
                  window.location.href = `/u/${matchProfile.id}`;
                }}
                style={{
                  padding: "12px 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                View Profile
              </button>

              <button
                onClick={async () => {
                  const { data } = await supabase.auth.getUser();
                  const me = data.user?.id;

                  const { data: sessionData } =
                    await supabase.auth.getSession();
                  const token = sessionData.session?.access_token;

                  if (!token || !me || !matchProfile?.id) return;

                  const res = await fetch("/api/conversations/get-or-create", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      to: matchProfile.id,
                    }),
                  });

                  const json = await res.json().catch(() => ({}));

                  if (!res.ok || !json?.conversation_id) {
                    console.error("GET OR CREATE ERROR:", json);
                    return;
                  }

                  const conversationId = json.conversation_id;


                 window.location.href = `/messages/${conversationId}?firstMessage=${encodeURIComponent("Looks like we matched 😈")}`;
                }}
                style={{
                  padding: "12px 18px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(180deg,#ec4899,#9d174d)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 0 16px rgba(236,72,153,0.35)",
                }}
              >
                Send Message 💬
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
