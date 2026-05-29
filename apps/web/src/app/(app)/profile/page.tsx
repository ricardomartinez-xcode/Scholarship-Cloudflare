import { redirect } from "next/navigation";
import Link from "next/link";

import AgendaPanel from "@/components/unidep/AgendaPanel";
import { auth } from "@/lib/auth/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const buildUrl = (key: "error" | "success", message: string) =>
  `/profile?${key}=${encodeURIComponent(message)}`;

function normalizeDisplayName(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function updateDisplayNameAction(formData: FormData) {
  "use server";

  const user = await requireAuth();
  const displayName = normalizeDisplayName(formData.get("displayName"));

  if (displayName && (displayName.length < 2 || displayName.length > 40)) {
    redirect(buildUrl("error", "El nickname debe tener entre 2 y 40 caracteres."));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { displayName: displayName || null },
  });

  redirect(buildUrl("success", "Nombre visible actualizado."));
}

async function changePasswordAction(formData: FormData) {
  "use server";

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect(buildUrl("error", "Completa todos los campos."));
  }
  if (newPassword !== confirmPassword) {
    redirect(buildUrl("error", "Las contraseñas no coinciden."));
  }

  const result = await auth.changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  });

  if (result?.error) {
    redirect(
      buildUrl(
        "error",
        result.error.message ?? "No fue posible cambiar la contraseña."
      )
    );
  }

  redirect(buildUrl("success", "Contraseña actualizada."));
}

async function signOutAction() {
  "use server";
  await auth.signOut();
  redirect("/");
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const user = await requireAuth();
  const email = user.email;
  const displayName = user.displayName?.trim() ?? "";
  const visibleName = displayName || email;

  return (
    <div className="grid gap-[var(--ui-shell-gap)]">
      <section className="ui-card ui-card-pad overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-stretch">
          <div className="min-w-0">
            <div className="ui-kicker">Área personal</div>
            <h1 className="ui-title-section mt-2 text-[color:var(--ui-text-primary)]">
              Seguimiento y cuenta
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--ui-text-secondary)]">
              Gestiona tu identidad visible, revisa tu agenda y mantén segura tu
              sesión sin salir del flujo operativo de ReCalc.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/unidep"
                className="ui-button-secondary text-xs uppercase tracking-[0.2em]"
              >
                Volver a Becas
              </Link>
            </div>
          </div>

          <aside className="ui-card-muted grid content-start gap-4 p-4 text-sm">
            <div>
              <div className="ui-kicker">Sesión activa</div>
              <div className="mt-2 truncate font-semibold text-[color:var(--ui-text-primary)]">
                {visibleName}
              </div>
              {displayName ? (
                <div className="mt-1 truncate text-xs text-[color:var(--ui-text-secondary)]">
                  {email}
                </div>
              ) : null}
            </div>

            <form action={updateDisplayNameAction} className="grid gap-2">
              <label className="grid gap-1 text-xs font-semibold text-[color:var(--ui-text-primary)]">
                Nickname visible
                <input
                  name="displayName"
                  defaultValue={displayName}
                  className="ui-control"
                  maxLength={40}
                  placeholder="Ej. Ricardo"
                />
              </label>
              <button type="submit" className="ui-button-info w-full text-sm">
                Guardar nickname
              </button>
            </form>

            <p className="text-xs leading-5 text-[color:var(--ui-text-secondary)]">
              Este nombre aparece en tu drawer, Inbox y mensajes internos.
            </p>

            <form action={signOutAction}>
              <button type="submit" className="ui-button-secondary w-full">
                Cerrar sesión
              </button>
            </form>
          </aside>
        </div>
      </section>

      <section className="grid gap-[var(--ui-shell-gap)] xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
        <div className="min-w-0">
          <AgendaPanel collapsible={false} defaultOpen integrationNextPath="/profile" />
        </div>

        <section className="ui-card ui-card-pad min-w-0 self-start">
          <div className="ui-kicker">Ajustes de cuenta</div>
          <h2 className="mt-2 text-lg font-semibold text-[color:var(--ui-text-primary)]">
            Cambiar contraseña
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--ui-text-secondary)]">
            Actualiza tus credenciales y revoca otras sesiones para mantener tu
            acceso protegido.
          </p>

          {params?.error ? (
            <div className="ui-note ui-note--danger mt-4 text-sm">{params.error}</div>
          ) : null}
          {params?.success ? (
            <div className="ui-note ui-note--success mt-4 text-sm">{params.success}</div>
          ) : null}

          <form action={changePasswordAction} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
              Correo
              <input value={email} readOnly className="ui-control opacity-80" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
              Contraseña actual
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                className="ui-control"
                placeholder="Tu contraseña actual"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
              Nueva contraseña
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                className="ui-control"
                placeholder="Nueva contraseña"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
              Confirmar nueva contraseña
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="ui-control"
                placeholder="Repite la nueva contraseña"
              />
            </label>

            <button type="submit" className="ui-button-primary w-full">
              Guardar cambios
            </button>
          </form>
        </section>
      </section>
    </div>
  );
}
