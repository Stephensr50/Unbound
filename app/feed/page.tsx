"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type Post = {
  id: number;
  body: string;
  created_at: string;
  user_id: string;
};

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("posts")
        .select("id, body, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!isMounted) return;

      if (error) {
        setError(error.message);
        setPosts([]);
      } else {
        setPosts((data as Post[]) ?? []);
      }

      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>Feed</h1>

      {loading && <div>Loading...</div>}
      {error && (
        <div style={{ padding: 12, border: "1px solid #ef4444" }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && posts.length === 0 && <div>No posts yet.</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {posts.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              {new Date(p.created_at).toLocaleString()}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{p.body}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
              user: {p.user_id}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
