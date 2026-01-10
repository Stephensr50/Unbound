"use client";

<<<<<<< HEAD
import { supabase } from "./supabaseClient";
import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Checking Supabase...");

  useEffect(() => {
    const checkSupabase = async () => {
      const { error } = await supabase
        .from("test")
        .select("*");

      if (error) {
        setStatus("Connected to Supabase (no table yet)");
      } else {
        setStatus("Supabase connected successfully 🎉");
      }
    };

    checkSupabase();
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h1>{status}</h1>
=======
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // fields for setup form
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const session = data.session;
      if (!session) {
        window.location.href = "/auth";
        return;
      }

      setEmail(session.user.email ?? null);

      const userId = session.user.id;

      // 1) Fetch profile row
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .eq("id", userId)
        .single();

      // 2) If it doesn't exist yet, create it (safe fallback)
      if (profErr && (profErr as any).code === "PGRST116") {
        const { data: created, error: createErr } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            username: null,
            display_name: null,
            bio: null,
            avatar_url: null,
          })
          .select("id, username, display_name, bio, avatar_url")
          .single();

        if (createErr) {
          setErrorMsg(createErr.message);
          setLoading(false);
          return;
        }

        setProfile(created as Profile);
        setLoading(false);
        return;
      }

      if (profErr) {
        setErrorMsg(profErr.message);
        setLoading(false);
        return;
      }

      setProfile(prof as Profile);

      // prefill form fields if they exist
      setUsername(prof?.username ?? "");
      setDisplayName(prof?.display_name ?? "");
      setBio(prof?.bio ?? "");

      setLoading(false);
    };

    run();
  }, []);

  const saveProfile = async () => {
    if (!profile) return;

    const cleanedUsername = username.trim();
    if (!cleanedUsername) {
      setErrorMsg("Username is required.");
      return;
    }

    // optional: basic username rule (letters/numbers/underscore, 3-20)
    const ok = /^[a-zA-Z0-9_]{3,20}$/.test(cleanedUsername);
    if (!ok) {
      setErrorMsg("Username must be 3–20 chars (letters, numbers, underscore).");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        username: cleanedUsername,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", profile.id)
      .select("id, username, display_name, bio, avatar_url")
      .single();

    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    setProfile(data as Profile);
    setSaving(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  if (loading) {
    return <p style={{ padding: 20 }}>Loading…</p>;
  }

  if (errorMsg) {
    return (
      <main style={{ padding: 20 }}>
        <h1>Unbound</h1>
        <p style={{ color: "crimson" }}>{errorMsg}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </main>
    );
  }

  // If profile not loaded for some reason, fallback
  if (!profile) {
    return (
      <main style={{ padding: 20 }}>
        <h1>Unbound</h1>
        <p>No profile loaded.</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </main>
    );
  }

  const needsSetup = !profile.username;

  return (
    <main style={{ padding: 20 }}>
      <h1>Welcome to Unbound</h1>
      <p>
        You are signed in as: <b>{email ?? "Unknown"}</b>
      </p>
      <button onClick={signOut} style={{ marginBottom: 20 }}>
        Sign out
      </button>

      {needsSetup ? (
        <section
          style={{
            maxWidth: 520,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "white",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Finish setting up your profile</h2>

          <label style={{ display: "block", marginBottom: 6 }}>
            Username (required)
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. robby_78"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
          />

          <label style={{ display: "block", marginBottom: 6 }}>
            Display name (optional)
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Robby"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
          />

          <label style={{ display: "block", marginBottom: 6 }}>
            Bio (optional)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A little about you…"
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
          />

          <button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </section>
      ) : (
        <section
          style={{
            maxWidth: 520,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "white",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Profile</h2>
          <p>
            <b>Username:</b> {profile.username}
          </p>
          <p>
            <b>Display name:</b> {profile.display_name ?? "(none)"}
          </p>
          <p>
            <b>Bio:</b> {profile.bio ?? "(none)"}
          </p>
        </section>
      )}
>>>>>>> 0b55346 (Checkpoint: auth + profile setup working)
    </main>
  );
}
