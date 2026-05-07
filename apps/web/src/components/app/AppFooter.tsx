import Image from "next/image";

export default function AppFooter() {
  return (
    <footer className="flex items-center justify-center gap-2 py-1">
      <span className="text-xs text-slate-400">powered by</span>
      <Image
        src="/branding/logo-relead.png"
        alt="ReLead"
        width={220}
        height={72}
        loading="eager"
        className="h-auto w-[108px] select-none object-contain sm:w-[128px]"
      />
    </footer>
  );
}

