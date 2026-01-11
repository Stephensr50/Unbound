"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";

export default function AuthPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/app/feed");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 320 }}>
        <h2 style={{ textAlign: "center" }}>Sign in</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />

        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{ width: "100%", padding: 10 }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error && (
          <p style={{ color: "red", marginTop: 10 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
``
