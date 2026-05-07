import type { ReactNode } from "react";
import Image from "next/image";

type BrandedAuthShellHighlight = {
  label: string;
  value: string;
};

type BrandedAuthShellProps = {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  compact?: boolean;
  shellClassName?: string;
  surfaceTitle?: string;
  surfaceDescription?: ReactNode;
  supportingPoints?: string[];
  highlights?: BrandedAuthShellHighlight[];
  footer?: ReactNode;
  children?: ReactNode;
};

export default function BrandedAuthShell({
  surfaceTitle = "Continúa con tu acceso",
  surfaceDescription,
  footer,
  children,
}: BrandedAuthShellProps) {
  return (
    <section className="flex min-h-screen w-full items-center justify-center bg-white px-6 py-6">
      <div className="w-full max-w-md space-y-2">
        {/* Header */}
        <div className="text-center -mb-6 overflow-hidden">
          <Image
            src="/branding/logo-unidep.png"
            alt="UNIDEP"
            width={768}
            height={768}
            className="h-56 w-56 mx-auto object-contain -mt-6"
            priority
            quality={100}
            unoptimized
          />
        </div>

        {/* Form Card */}
        <div className="space-y-6">
          {surfaceTitle ? (
            <div className="text-center space-y-2">
              <div className="text-sm font-semibold text-slate-900">{surfaceTitle}</div>
              {surfaceDescription ? (
                <div className="text-sm text-slate-600">{surfaceDescription}</div>
              ) : null}
            </div>
          ) : null}

          {children ? <div className="space-y-4">{children}</div> : null}
        </div>

        {/* Footer */}
        {footer ? <div className="space-y-2 pt-6 border-t border-slate-200 text-center text-xs">{footer}</div> : null}
      </div>
    </section>
  );
}
