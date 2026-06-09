export const dynamic = "force-dynamic";

export default function CampaignMediaCaptionDocPage() {
  return (
    <main className="min-h-screen bg-[#020617] px-6 py-10 text-slate-100">
      <section className="mx-auto grid max-w-4xl gap-6 rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
            ReCalc Sender
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Envío de imágenes con caption en WhatsApp Web
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Actualización operativa del 09 de junio de 2026. Las campañas con
            imagen deben enviarse como foto o video normal con el texto como
            caption, nunca como sticker.
          </p>
        </div>

        <div className="grid gap-4 text-sm leading-6 text-slate-300">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-base font-semibold text-white">Qué cambió</h2>
            <p className="mt-2">
              El runtime de extensión ahora declara <code>mediaCaptionPolicy</code>
              y requiere ReCalc Sender 6.2.2 o superior para campañas con
              <code> mediaUrl</code>. La extensión selecciona “Fotos y videos”,
              bloquea el fallback de stickers y usa el template como caption
              dentro del preview.
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-base font-semibold text-white">Flujo esperado</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              <li>
                El backend entrega selector pack actualizado y
                <code> mediaCaptionPolicy.mode = &quot;compose_caption&quot;</code>.
              </li>
              <li>
                La extensión abre el menú de adjuntos y busca “Fotos y videos”
                con sinónimos en español e inglés.
              </li>
              <li>
                El texto del template se pre-carga en el composer o se escribe
                en el caption del preview.
              </li>
              <li>
                El envío final sale como imagen con caption; el fallback de
                texto separado queda desactivado cuando hay media.
              </li>
            </ol>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-base font-semibold text-white">Validación rápida</h2>
            <p className="mt-2">
              Crea una campaña de prueba con una imagen y un template corto. En
              WhatsApp Web debe abrirse el preview de foto/video, verse el
              caption y enviarse una imagen normal. Si aparece el editor de
              stickers, actualiza la extensión y vuelve a iniciar sesión.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
