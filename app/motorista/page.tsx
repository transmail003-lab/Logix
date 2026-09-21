import Link from "next/link";

export default function MotoristaHome() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-xl font-semibold">Panel de Motorista</h1>
      <div className="space-y-3">
        <Link
          href="/motorista/jornada"
          className="block rounded-xl bg-brand-600 px-4 py-4 text-center text-sm font-medium text-white"
        >
          Iniciar jornada
        </Link>
        <Link
          href="/motorista/manifiesto"
          className="block rounded-xl bg-white px-4 py-4 text-center text-sm font-medium text-brand-700 ring-1 ring-brand-200"
        >
          Manifiesto / escaneo
        </Link>
        <Link
          href="/motorista/ruta"
          className="block rounded-xl bg-white px-4 py-4 text-center text-sm font-medium text-brand-700 ring-1 ring-brand-200"
        >
          Entregas en ruta
        </Link>
      </div>
    </main>
  );
}
