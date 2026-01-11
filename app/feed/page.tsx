"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type Post = {
  id: number;
  body: string;
  user_id: string;
  created_at: string;
};

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("posts")
        .select("id, body, user_id, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setPosts([]);
      } else {
        setPosts((data ?? []) as Post[]);
      }

      setLoading(false);
    };

    loadPosts();
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 42, fontWeight: 800, marginBottom: 16 }}>
        Feed
      </h1>

      {loading && <div>Loading…</div>}

      {!loading && error && (
        <div
          style={{
            padding: 12,
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          Error: {error}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div>No posts yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
              background: "white",
            }}
          >
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 6 }}>
              {new Date(p.created_at).toLocaleString()}
            </div>

            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {p.body}
            </div>

            <div style={{ fontSize: 12, color: "#6b7280" }}>
              user: {p.user_id}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
