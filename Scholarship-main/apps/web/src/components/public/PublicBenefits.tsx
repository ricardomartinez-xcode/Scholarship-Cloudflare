export default function PublicBenefits() {
  const benefits = [
    {
      icon: "01",
      title: "Calcula tu beca",
      description: "Descubre tu beca personalizada en cuestión de minutos. Ingresa tus datos y obtén resultados precisos.",
      features: ["Cálculo automático", "Resultados al instante", "Sin complicaciones"],
    },
    {
      icon: "02",
      title: "Gestiona tu solicitud",
      description: "Mantén el seguimiento de tu proceso en tiempo real. Sabe exactamente en qué etapa estás.",
      features: ["Panel de seguimiento", "Notificaciones", "Acceso 24/7"],
    },
    {
      icon: "03",
      title: "Seguridad garantizada",
      description: "Tu información está protegida con los más altos estándares de seguridad.",
      features: ["Encriptación SSL", "GDPR compatible", "Auditoría completa"],
    },
    {
      icon: "04",
      title: "Capacitación incluida",
      description: "Accede a recursos, guías y sesiones de capacitación exclusivas para potenciar tu aprendizaje.",
      features: ["Materiales interactivos", "Sesiones en vivo", "Comunidad de apoyo"],
    },
  ];

  return (
    <section id="beneficios" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-[var(--ui-shell-pad-x)]">
        <div className="mb-10 max-w-3xl">
          <h2 className="mb-4 text-3xl font-bold text-[#0F3C55] sm:text-4xl">
            ¿Por qué elegir ReCalc?
          </h2>
          <p className="text-lg text-[#4f6b81]">
            La plataforma más completa para estudiantes UNIDEP. Todo lo que necesitas en un solo lugar.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, idx) => (
            <div
              key={idx}
              className="group rounded-lg border border-[#D7E4ED] bg-[#F7FBFD] p-5 transition hover:border-[rgba(17,78,109,0.28)] hover:bg-white hover:shadow-[0_16px_34px_rgba(18,51,72,0.08)]"
            >
              <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-[6px] bg-[#114E6D] text-sm font-bold text-white">
                {benefit.icon}
              </div>
              <h3 className="mb-2 font-semibold text-[#0F3C55]">{benefit.title}</h3>
              <p className="mb-4 text-sm leading-6 text-[#657D8F]">{benefit.description}</p>
              
              <ul className="space-y-2">
                {benefit.features.map((feature, fidx) => (
                  <li key={fidx} className="flex items-center gap-2 text-xs font-medium text-[#365770]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6CB514]" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
