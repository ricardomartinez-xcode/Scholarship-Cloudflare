import AppFooter from "@/components/app/AppFooter";

export default function AdminPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="ui-page-backdrop min-h-screen text-slate-100">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[var(--ui-shell-max-width)] flex-col px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full">{children}</div>
        </div>
        <AppFooter />
      </div>
    </main>
  );
}
