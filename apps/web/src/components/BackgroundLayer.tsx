export default function BackgroundLayer() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <div
        className="h-[min(860px,92vw)] w-[min(860px,92vw)] bg-[url('/branding/logo-unidep.png')] bg-contain bg-center bg-no-repeat opacity-15"
        role="presentation"
      />
    </div>
  );
}
