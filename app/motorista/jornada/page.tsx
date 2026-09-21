"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JornadaPage() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", dni: "", placa: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function iniciarJornada(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sesión no encontrada.");
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("shifts")
      .insert({
        driver_id: user.id,
        driver_name_snapshot: form.nombre,
        driver_dni_snapshot: form.dni,
        vehicle_plate_snapshot: form.placa
      })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      setError("No se pudo iniciar la jornada. Intenta de nuevo.");
      return;
    }

    // Guarda la jornada activa en localStorage para uso offline en los siguientes módulos
    localStorage.setItem("logix_shift_id", data.id);
    router.push("/motorista/manifiesto");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-1 text-lg font-semibold">Inicio de jornada</h1>
      <p className="mb-6 text-sm text-slate-500">
        Confirma tus datos antes de comenzar a escanear paquetes.
      </p>

      <form onSubmit={iniciarJornada} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre del transportista</label>
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">DNI</label>
          <input
            required
            value={form.dni}
            onChange={(e) => setForm({ ...form, dni: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Número de placa</label>
          <input
            required
            value={form.placa}
            onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          disabled={saving}
          className="w-full rounded-lg bg-brand-600 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Iniciar ruta"}
        </button>
      </form>
    </main>
  );
}
