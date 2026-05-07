import Image from "next/image";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
  infoPanel?: ReactNode;
};

export default function AuthLayout({ children, infoPanel }: AuthLayoutProps) {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-white">
      <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-6">
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

          {/* Form Content */}
          <div className="space-y-6">{children}</div>

          {/* Info Panel */}
          {infoPanel && <div className="space-y-4 pt-6 border-t border-slate-200">{infoPanel}</div>}
        </div>
      </div>
    </section>
  );
}
