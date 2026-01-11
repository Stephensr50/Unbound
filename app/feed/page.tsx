"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type Post = {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
};

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("posts")
        .select("id,user_id,body,created_at")
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        setError(error.message);
        setPosts([]);
      } else {
        setPosts((data as Post[]) ?? []);
      }

      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 16 }}>Feed</h1>

      {loading && <p>Loading...</p>}

      {!loading && error && (
        <p style={{ color: "crimson" }}>
          Error: {error}
        </p>
      )}

      {!loading && !error && posts.length === 0 && <p>No posts yet.</p>}

      {!loading && !error && posts.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.map((post) => (
            <div
              key={post.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 12,
                background: "white",
              }}
            >
              <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 6 }}>
                {new Date(post.created_at).toLocaleString()}
              </div>

              <div style={{ fontSize: 16, lineHeight: 1.4 }}>{post.body}</div>

              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                user: {post.user_id}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
