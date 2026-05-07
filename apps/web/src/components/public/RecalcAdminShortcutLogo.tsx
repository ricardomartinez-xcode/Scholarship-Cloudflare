"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function RecalcAdminShortcutLogo({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const clicksRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center rounded-2xl p-1 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(31,108,140,0.3)]"
      aria-label="ReCalc"
      onClick={() => {
        clicksRef.current += 1;
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          clicksRef.current = 0;
          timerRef.current = null;
        }, 850);

        if (clicksRef.current >= 3) {
          clicksRef.current = 0;
          if (timerRef.current) window.clearTimeout(timerRef.current);
          timerRef.current = null;
          router.push("/admin/auth");
        }
      }}
    >
      <Image
        src="/branding/logo-recalc.png"
        alt="ReCalc"
        width={320}
        height={104}
        className={className}
      />
    </button>
  );
}
