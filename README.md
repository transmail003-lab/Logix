# Logix — Sistema de Trazabilidad y Última Milla

Next.js 14 (App Router) + Tailwind CSS + Supabase (Auth, Postgres, Storage, Realtime) + Vercel.
Sin gestión de sucursales. Login único con detección automática de rol.

## 1. Crear el proyecto en Supabase

1. Entra a https://supabase.com/dashboard y crea un nuevo proyecto.
2. Ve a **SQL Editor** y ejecuta, en orden:
   1. `supabase/schema.sql` — crea tablas, enums, triggers y políticas RLS.
   2. `supabase/seed_test_users.sql` — crea los 4 usuarios de prueba (ver abajo).
   - Si el paso 2 falla con un error de `auth.users`, crea los usuarios manualmente desde
     **Authentication → Users → Add user**, usando los mismos correos y agregando en
     "User Metadata" un JSON `{"full_name": "...", "role": "admin"}` (o el rol que corresponda).
3. Ve a **Project Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Verifica en **Storage** que se crearon los buckets `evidence` y `signatures`
   (el script los crea automáticamente).

## 2. Subir el código a GitHub

```bash
cd logix
git init
git add .
git commit -m "Logix: sistema de trazabilidad de última milla"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/logix.git
git push -u origin main
```

## 3. Desplegar en Vercel (sin instalación local)

1. Entra a https://vercel.com/new e importa el repositorio de GitHub recién creado.
2. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Framework Preset: Vercel lo detecta automáticamente como **Next.js**.
4. Haz clic en **Deploy**. Cada `git push` a `main` vuelve a desplegar automáticamente.
5. (Opcional) En **Project Settings → Domains**, agrega un dominio propio.

No necesitas instalar Node.js ni ejecutar nada localmente: GitHub + Vercel construyen
el proyecto en la nube.

## 4. Usuarios de prueba

Contraseña para todos: **`Logix2026!`**

| Correo | Rol | Panel al iniciar sesión |
|---|---|---|
| admin@logix.com | admin | `/admin` — gestión de usuarios y roles |
| coordinador@logix.com | coordinador | `/coordinador` — dashboard en tiempo real |
| bodega@logix.com | bodega | `/bodega` — recepción de manifiestos |
| motorista@logix.com | motorista | `/motorista` — jornada, escaneo y ruta |

El login (`/login`) es único para todos los roles: no hay selección manual de panel.
El middleware (`middleware.ts`) consulta `profiles.role` justo después de autenticar
y redirige automáticamente al panel correspondiente.

## 5. Estructura del proyecto

```
logix/
├─ app/
│  ├─ login/page.tsx              Login único, sin selección de rol
│  ├─ admin/page.tsx              Módulo 5 — RBAC / gestión de usuarios
│  ├─ coordinador/page.tsx        Módulo 5 — dashboard en tiempo real
│  ├─ bodega/
│  │  ├─ page.tsx
│  │  └─ recepcion/page.tsx       Módulo 4 — QR maestro + firma POD
│  └─ motorista/
│     ├─ jornada/page.tsx         Módulo 1 — datos de inicio de ruta
│     ├─ manifiesto/page.tsx      Módulo 2 — escaneo en ráfaga + OCR + QR
│     ├─ ruta/page.tsx            Módulo 3 — offline-first, entregas/incidencias
│     └─ page.tsx
├─ components/
│  ├─ scanner/BarcodeScanner.tsx  Escaneo continuo (cámara)
│  ├─ scanner/OcrFallback.tsx     Respaldo OCR para tickets dañados
│  └─ signature/SignaturePad.tsx  Firma digital en pantalla táctil
├─ lib/
│  ├─ supabase/{client,server}.ts
│  └─ offline/{db,sync}.ts        IndexedDB + sincronización en 2do plano
├─ middleware.ts                  Login inteligente por detección de rol
├─ public/{manifest.json,sw.js}   PWA + Service Worker offline
└─ supabase/{schema.sql,seed_test_users.sql}
```

## 6. Cómo funciona el modo offline (Módulo 3)

1. El motorista escanea/registra entregas o incidencias sin conexión.
2. Cada acción se guarda en **IndexedDB** (`lib/offline/db.ts`) con un
   `client_uuid` generado en el dispositivo (garantiza idempotencia).
3. Al detectar el evento `online` del navegador (o cada 30s si ya hay señal),
   `lib/offline/sync.ts` sube la cola pendiente a Supabase y marca cada
   registro como sincronizado.
4. Las fotos de evidencia se guardan como `Blob` en IndexedDB y se suben a
   `Supabase Storage` (bucket `evidence`) en el mismo ciclo de sincronización.

## 7. Notas y siguientes pasos recomendados

Este repositorio es un **esqueleto funcional completo** de los 5 módulos: cubre
el modelo de datos, RLS, login por rol, escaneo en ráfaga con respaldo OCR,
cola offline con sync en segundo plano, recepción con QR maestro + firma, y
un dashboard en tiempo real. Antes de producción real, conviene sumar:

- Alertas automatizadas de SLA (cron / Supabase Edge Function que compare
  `sla_rules` contra `package_events` y notifique por correo/WhatsApp).
- Paginación y filtros en el dashboard de coordinación para volúmenes grandes.
- Íconos PWA reales en `public/icons/` (192x192 y 512x512).
- Pruebas end-to-end del flujo offline en un dispositivo real de gama básica.
