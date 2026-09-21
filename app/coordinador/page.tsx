"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PackageRow {
  id: string;
  tracking_code: string;
  status: string;
  updated_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  registrado: "Registrado",
  en_ruta: "En ruta",
  entregado: "Entregado",
  no_entregado: "No entregado",
  recibido_bodega: "Recibido en bodega"
};

const STATUS_COLOR: Record<string, string> = {
  registrado: "bg-slate-100 text-slate-700",
  en_ruta: "bg-blue-100 text-blue-700",
  entregado: "bg-emerald-100 text-emerald-700",
  no_entregado: "bg-red-100 text-red-700",
  recibido_bodega: "bg-purple-100 text-purple-700"
};

export default function CoordinadorDashboard() {
  const supabase = createClient();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [incidentsCount, setIncidentsCount] = useState(0);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("packages")
        .select("id, tracking_code, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (data) setPackages(data as PackageRow[]);

      const { count } = await supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false);
      setIncidentsCount(count ?? 0);
    }
    load();

    // Monitoreo en tiempo real: cualquier cambio en 'packages' refresca el tablero
    const channel = supabase
      .channel("packages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "packages" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = Object.keys(STATUS_LABEL).map((key) => ({
    key,
    label: STATUS_LABEL[key],
    count: packages.filter((p) => p.status === key).length
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Panel de Coordinación</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {summary.map((s) => (
          <div key={s.key} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-2xl font-bold">{s.count}</p>
          </div>
        ))}
        <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
          <p className="text-xs text-red-600">Incidencias abiertas</p>
          <p className="text-2xl font-bold text-red-700">{incidentsCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono">{p.tracking_code}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(p.updated_at).toLocaleString("es-HN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
