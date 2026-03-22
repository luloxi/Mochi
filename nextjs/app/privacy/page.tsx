"use client";

import { useLanguage } from "@/components/language-provider";

export default function PrivacyPage() {
  const { isSpanish } = useLanguage();

  return (
    <main className="min-h-screen overflow-x-hidden neural-shell">
      <section className="max-w-4xl mx-auto px-6 py-16 text-foreground">
        <div className="neural-card p-10 md:p-12 bg-[#0b0f14]">
          <h1 className="text-3xl md:text-4xl font-semibold mb-4">
            {isSpanish ? "Política de Privacidad" : "Privacy Policy"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isSpanish
              ? "Última actualización: 7 de febrero de 2026."
              : "Last updated: February 7, 2026."}
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              {isSpanish
                ? "Mochi es una extensión de navegador que te permite interactuar con mascotas animadas y conectarlas a proveedores de IA o a tu propio agente."
                : "Mochi is a browser extension that lets you interact with animated pets and connect them to AI providers or your own agent."}
            </p>

            <div>
              <h2 className="text-foreground font-semibold mb-2">
                {isSpanish ? "Datos que se usan" : "Data We Use"}
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  {isSpanish
                    ? "Mensajes que escribes o dictas al Mochi (para responder)."
                    : "Messages you type or dictate to the Mochi (to generate responses)."}
                </li>
                <li>
                  {isSpanish
                    ? "Configuraciones locales de la extensión (personajes, apariencia, preferencias)."
                    : "Local extension settings (characters, appearance, preferences)."}
                </li>
                <li>
                  {isSpanish
                    ? "Claves de API o tokens si decides configurarlos (almacenados localmente)."
                    : "API keys or tokens if you choose to configure them (stored locally)."}
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-foreground font-semibold mb-2">
                {isSpanish ? "Dónde se procesan los mensajes" : "Where Messages Are Processed"}
              </h2>
              <p>
                {isSpanish
                  ? "Si usas OpenRouter, tus mensajes se envían a los modelos seleccionados en OpenRouter. Si usas Ollama u OpenClaw locales, los mensajes se procesan en tu propio equipo o red local."
                  : "If you use OpenRouter, your messages are sent to the selected models on OpenRouter. If you use local Ollama or OpenClaw, messages are processed on your own machine or local network."}
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold mb-2">
                {isSpanish ? "Almacenamiento" : "Storage"}
              </h2>
              <p>
                {isSpanish
                  ? "Las configuraciones y claves se guardan en el almacenamiento local de tu navegador. Puedes habilitar una clave maestra para protegerlas con cifrado adicional."
                  : "Settings and keys are stored in your browser’s local storage. You can enable a master key to protect them with additional encryption."}
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold mb-2">
                {isSpanish ? "Compartir datos" : "Data Sharing"}
              </h2>
              <p>
                {isSpanish
                  ? "No vendemos tus datos. Solo se comparten con los proveedores que tú configuras para que el Mochi responda."
                  : "We do not sell your data. It is only shared with providers you configure so the Mochi can respond."}
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold mb-2">
                {isSpanish ? "Contacto" : "Contact"}
              </h2>
              <p>
                {isSpanish ? (
                  <>
                    Si tienes preguntas, contáctanos en X/Twitter{" "}
                    <a
                      href="https://x.com/MochiAgents"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline decoration-2 underline-offset-2 text-[var(--brand-accent)] hover:opacity-80"
                    >
                      @MochiAgents
                    </a>
                    .
                  </>
                ) : (
                  <>
                    If you have questions, contact us on X/Twitter{" "}
                    <a
                      href="https://x.com/MochiAgents"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline decoration-2 underline-offset-2 text-[var(--brand-accent)] hover:opacity-80"
                    >
                      @MochiAgents
                    </a>
                    .
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
