"use client";
import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // app/page.tsx
useEffect(() => {
  setLoading(true);
  fetch(`/api/dashboard?month=${month}`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text(); // text first, not json
    })
    .then((text) => {
      console.log("Raw response:", text); // see exactly what came back
      const d = JSON.parse(text);
      setData(d);
      setLoading(false);
    })
    .catch((err) => {
      console.error("Dashboard fetch failed:", err);
      setLoading(false);
    });
}, [month]);

  return (
    <main>
      <Dashboard
        data={data}
        month={month}
        onMonthChange={setMonth}
        loading={loading}
      />
    </main>
  );
}