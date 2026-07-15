"use client";

import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import TenantDetails from "./TenantDetails";

export default function TenantHome() {
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [selectedTenant, setSelectedTenant] =
    useState<any>(null);

  useEffect(() => {
    setLoading(true);

    fetch(`/api/dashboard?month=${month}`)
      .then((r) => {
        if (!r.ok)
          throw new Error(`HTTP ${r.status}`);

        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error(
          "Dashboard fetch failed:",
          err
        );

        setLoading(false);
      });
  }, [month]);

  if (selectedTenant) {
    return (
      <TenantDetails
        tenant={selectedTenant}
        onBack={() => setSelectedTenant(null)}
      />
    );
  }

  return (
    <main>
      <Dashboard
        data={data}
        month={month}
        onMonthChange={setMonth}
        loading={loading}
        onTenantClick={setSelectedTenant}
      />
    </main>
  );
}