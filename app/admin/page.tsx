"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
}

const ROLES = ["admin", "coordinador", "bodega", "motorista"];

export default function AdminPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .order("full_name");
    if (data) setProfiles(data as Profile[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateRole(id: string, role: string) {
    setSavingId(id);
    await supabase.from("profiles").update({ role }).eq("id", id);
    await supabase.from("audit_logs").insert({
      action: "update_role",
      entity: "profiles",
      entity_id: id,
      metadata: { new_role: role }
    });
    await load();
    setSavingId(null);
  }

  async function toggleActive(id: string, active: boolean) {
    setSavingId(id);
    await supabase.from("profiles").update({ active: !active }).eq("id", id);
    await load();
    setSavingId(null);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold">Usuarios y roles</h1>
      <p className="mb-6 text-sm text-slate-500">
        El rol asignado aquí determina el panel al que cada usuario será redirigido al iniciar sesión.
      </p>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Activo</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{p.full_name}</td>
                <td className="px-4 py-2">
                  <select
                    value={p.role}
                    disabled={savingId === p.id}
                    onChange={(e) => updateRole(p.id, e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleActive(p.id, p.active)}
                    disabled={savingId === p.id}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {p.active ? "Activo" : "Inactivo"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
