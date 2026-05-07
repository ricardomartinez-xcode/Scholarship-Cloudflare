import Link from "next/link";

import BrandedAuthShell from "@/components/auth/BrandedAuthShell";
import InviteAcceptClient from "@/components/invite/InviteAcceptClient";
import { getSessionUser } from "@/lib/authz";
import { getInviteByToken } from "@/lib/invites";
import { getSystemRoleMeta } from "@/lib/system-roles";

export const dynamic = "force-dynamic";

const maskEmail = (email: string) => {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}${domain}`;
};

export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const token = String(params?.token ?? "").trim();

  if (!token) {
    return (
      <Layout>
        <StatusCard
          title="Falta el token"
          tone="error"
          message="El enlace no incluye el token de invitación."
        />
      </Layout>
    );
  }

  const invite = await getInviteByToken(token);
  if (!invite) {
    return (
      <Layout>
        <StatusCard
          title="Invitación inválida"
          tone="error"
          message="No encontramos una invitación activa para este enlace."
        />
      </Layout>
    );
  }

  const sessionState = await getSessionUser();

  const roleLabel = getSystemRoleMeta(invite.role).label;
  const nextTarget = `/invite/accept?token=${encodeURIComponent(token)}`;

  return (
    <Layout>
      <InvitationSummary
        inviteeEmail={invite.email}
        inviterEmail={invite.inviterEmail}
        organizationName={invite.organizationName}
        roleLabel={roleLabel}
        expiresAt={invite.expiresAt}
      />

      {invite.status === "used" ? (
        <>
          <StatusCard
            title="Invitación ya utilizada"
            tone="success"
            message="Este acceso ya fue aceptado anteriormente."
          />
          <Link
            href={sessionState.status === "ok" ? "/unidep?welcome=1" : "/auth/sign-in"}
            className="block w-full rounded-2xl bg-[#1F6C8C] px-3 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#0F3C55]"
          >
            {sessionState.status === "ok" ? "Ir a la app" : "Iniciar sesión"}
          </Link>
        </>
      ) : null}

      {invite.status === "cancelled" ? (
        <StatusCard
          title="Invitación cancelada"
          tone="error"
          message="Este enlace fue cancelado. Solicita una nueva invitación."
        />
      ) : null}

      {invite.status === "expired" ? (
        <StatusCard
          title="Invitación expirada"
          tone="error"
          message="El enlace venció. Solicita a tu equipo que te genere uno nuevo."
        />
      ) : null}

      {invite.status === "pending" && sessionState.status !== "ok" ? (
        <>
          <StatusCard
            title="Accede con este correo"
            tone="info"
            message="Si ya usabas este correo, inicia sesión con la misma cuenta. Si aún no la activaste o ya no recuerdas el acceso, crea la cuenta o recupera la contraseña y vuelve a esta pantalla para confirmar la invitación."
          />
          <div className="grid gap-2">
            <Link
              href={`/auth/sign-in?email=${encodeURIComponent(invite.email)}&fromInvite=1&next=${encodeURIComponent(nextTarget)}`}
              className="block w-full rounded-2xl bg-[#1F6C8C] px-3 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#0F3C55]"
            >
              Iniciar sesión con este correo
            </Link>
            <Link
              href={`/auth/sign-up?token=${encodeURIComponent(token)}`}
              className="block w-full rounded-2xl border border-white/15 bg-[#17385F] px-3 py-2.5 text-center text-sm font-semibold text-slate-100 transition hover:bg-[#0F3C55]"
            >
              Crear cuenta con este correo
            </Link>
            <Link
              href={`/auth/forgot-password?email=${encodeURIComponent(invite.email)}`}
              className="text-center text-xs text-slate-300 underline"
            >
              Recuperar acceso con este correo
            </Link>
          </div>
        </>
      ) : null}

      {invite.status === "pending" &&
      sessionState.status === "ok" &&
      sessionState.email.toLowerCase() !== invite.email.toLowerCase() ? (
        <>
          <StatusCard
            title="Cuenta equivocada"
            tone="warning"
            message={`La sesión actual corresponde a ${sessionState.email}, pero la invitación es para ${maskEmail(invite.email)}.`}
          />
          <Link
            href={`/auth/sign-in?email=${encodeURIComponent(invite.email)}&fromInvite=1&next=${encodeURIComponent(nextTarget)}`}
            className="block w-full rounded-2xl border border-white/15 bg-[#17385F] px-3 py-2.5 text-center text-sm font-semibold text-slate-100 transition hover:bg-[#0F3C55]"
          >
            Cambiar cuenta
          </Link>
        </>
      ) : null}

      {invite.status === "pending" &&
      sessionState.status === "ok" &&
      sessionState.email.toLowerCase() === invite.email.toLowerCase() ? (
        <>
          <StatusCard
            title="Listo para aceptar"
            tone="success"
            message="La cuenta autenticada coincide con la invitación. Revisa el acceso y confirma la aceptación."
          />
          <InviteAcceptClient token={token} />
        </>
      ) : null}
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <BrandedAuthShell
      eyebrow="Invitaciones"
      title="Revisar invitación"
      description="Esta pantalla solo inspecciona el acceso. La invitación se consume cuando la aceptas explícitamente."
    >
      {children}
    </BrandedAuthShell>
  );
}

function InvitationSummary({
  inviteeEmail,
  inviterEmail,
  organizationName,
  roleLabel,
  expiresAt,
}: {
  inviteeEmail: string;
  inviterEmail: string;
  organizationName: string | null;
  roleLabel: string;
  expiresAt: Date;
}) {
  return (
    <div className="ui-card-muted p-4 text-sm text-slate-300">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
        Contexto de invitación
      </div>
      <div className="mt-3 grid gap-2">
        <div>
          <span className="text-slate-500">Invita:</span>{" "}
          <span className="text-slate-100">{inviterEmail}</span>
        </div>
        <div>
          <span className="text-slate-500">Correo objetivo:</span>{" "}
          <span className="font-mono text-slate-100">{inviteeEmail}</span>
        </div>
        <div>
          <span className="text-slate-500">Acceso:</span>{" "}
          <span className="text-slate-100">{roleLabel}</span>
        </div>
        <div>
          <span className="text-slate-500">Organización:</span>{" "}
          <span className="text-slate-100">{organizationName ?? "Sin organización"}</span>
        </div>
        <div>
          <span className="text-slate-500">Expira:</span>{" "}
          <span className="text-slate-100">{new Date(expiresAt).toLocaleString("es-MX")}</span>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  message,
  tone,
}: {
  title: string;
  message: string;
  tone: "error" | "warning" | "info" | "success";
}) {
  const className =
    tone === "error"
      ? "ui-note ui-note--danger"
      : tone === "warning"
        ? "ui-note ui-note--warning"
        : tone === "success"
          ? "ui-note ui-note--success"
          : "ui-note ui-note--info";

  return (
    <div className={`${className} text-sm`}>
      <div className="font-semibold">{title}</div>
      <div className="mt-1">{message}</div>
    </div>
  );
}
