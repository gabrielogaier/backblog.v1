"use client";

import PublicHeader from "@/components/PublicHeader";

const lastUpdated = new Date().toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <PublicHeader />
      <main className="flex-1 px-6 py-12 sm:px-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 rounded-3xl border border-slate-900 bg-slate-900/70 px-6 py-8 shadow-lg shadow-slate-900/40 sm:px-10">
          <header className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Política de Privacidade — Backblog</p>
            <h1 className="text-3xl font-semibold text-white">Sua privacidade vem em primeiro lugar</h1>
            <p className="text-sm text-slate-400">Última atualização: {lastUpdated}</p>
          </header>

          <section className="space-y-4 text-sm leading-relaxed text-slate-200 sm:text-base">
            <p>Sua privacidade é importante. Este documento explica como seus dados são coletados, usados e protegidos.</p>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">1. Informações que coletamos</h2>
              <p>Durante o uso do Backblog, coletamos:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>Nome (para exibição);</li>
                <li>E-mail (para login e comunicação essencial);</li>
                <li>Senha (armazenada de forma criptografada);</li>
                <li>IP e dados de dispositivo (para segurança);</li>
                <li>Seus textos e anotações dentro do Backblog.</li>
              </ul>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">2. Como usamos seus dados</h2>
              <p>Usamos seus dados para:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>criar e manter sua conta;</li>
                <li>permitir login seguro;</li>
                <li>armazenar seus textos;</li>
                <li>melhorar o serviço;</li>
                <li>enviar e-mails essenciais (como recuperação de senha).</li>
              </ul>
              <p>Nunca vendemos dados e nunca usamos seus textos para treinar IA.</p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">3. Segurança</h2>
              <p>Tomamos medidas para proteger suas informações, como:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>criptografia de senhas;</li>
                <li>comunicação via HTTPS;</li>
                <li>restrições internas de acesso.</li>
              </ul>
              <p>Nenhum sistema é 100% inviolável, mas trabalhamos para manter sua conta segura.</p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">4. Seus textos</h2>
              <p>São privados por padrão:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>Não são analisados, publicados ou compartilhados;</li>
                <li>Não são indexados por mecanismos de busca;</li>
                <li>Se no futuro existir recurso de publicação, você poderá escolher o que é público.</li>
              </ul>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">5. Cookies e Sessões</h2>
              <p>Usamos cookies apenas para manter você logado e melhorar a experiência de navegação.</p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">6. Compartilhamento de dados</h2>
              <p>Não compartilhamos seus dados com terceiros, exceto:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>quando exigido por lei;</li>
                <li>quando necessário para segurança do serviço (por exemplo, mitigação de ataque).</li>
              </ul>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">7. Exclusão de dados</h2>
              <p>Você pode solicitar a exclusão total da sua conta e todos os dados associados. A remoção é permanente e irreversível.</p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">8. Dúvidas</h2>
              <p>Se tiver dúvidas sobre esta Política, entre em contato pelo suporte oficial.</p>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
