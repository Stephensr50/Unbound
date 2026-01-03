"use client";

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
    </main>
  );
}
