import MetaPixel from "@/components/analytics/MetaPixel";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="ui-page-backdrop min-h-screen text-[#123348]">
      <MetaPixel />
      <PublicHeader />
      <div className="relative z-10 flex flex-1 flex-col w-full">
        {children}
      </div>
      <PublicFooter />
    </main>
  );
}
