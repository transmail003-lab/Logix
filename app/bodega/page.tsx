import Link from "next/link";

export default function BodegaHome() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-xl font-semibold">Panel de Bodega</h1>
      <Link
        href="/bodega/recepcion"
        className="block rounded-xl bg-brand-600 px-4 py-4 text-center text-sm font-medium text-white"
      >
        Recibir manifiesto (escanear QR)
      </Link>
    </main>
  );
}
