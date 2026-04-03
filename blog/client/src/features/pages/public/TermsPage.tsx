"use client";

import PublicHeader from "@/components/PublicHeader";
import { formatDateBR } from "@/lib/dateTime";

const lastUpdated = formatDateBR(new Date(), {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <PublicHeader />
      <main className="flex-1 px-6 py-12 sm:px-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 rounded-3xl border border-slate-900 bg-slate-900/70 px-6 py-8 shadow-lg shadow-slate-900/40 sm:px-10">
          <header className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">TERMOS DE USO — Backblog</p>
            <h1 className="text-3xl font-semibold text-white">Crie sua conta com segurança</h1>
            <p className="text-sm text-slate-400">Última atualização: {lastUpdated}</p>
          </header>

          <section className="space-y-4 text-sm leading-relaxed text-slate-200 sm:text-base">
            <p>
              Bem-vindo ao Backblog! Ao criar uma conta ou usar o serviço, você concorda com estes Termos de Uso. Leia com atenção para
              entender como o produto funciona e quais são suas responsabilidades.
            </p>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">1. Sobre o Backblog</h2>
              <p>
                O Backblog é um espaço digital para registrar ideias, pensamentos, estudos e quaisquer textos que o usuário deseje manter
                organizados. É um serviço pessoal, simples e voltado ao uso individual.
              </p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">2. Cadastro</h2>
              <p>Para usar o Backblog, você precisa:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>fornecer um nome;</li>
                <li>um e-mail válido;</li>
                <li>criar uma senha.</li>
              </ul>
              <p>Você é responsável por manter sua senha em segurança e por toda atividade realizada com sua conta.</p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">3. Conteúdo do Usuário</h2>
              <p>Você mantém 100% dos direitos sobre tudo o que escreve no Backblog. Ao usar o serviço, você declara que:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>é o autor do conteúdo que publica;</li>
                <li>não está violando direitos de terceiros;</li>
                <li>não está enviando conteúdo ilegal, ofensivo, discriminatório ou que viole leis brasileiras.</li>
              </ul>
              <p>O Backblog não lê nem utiliza seus textos para treinar IA. Seu conteúdo é privado, exceto por funcionalidades futuras que você optar por compartilhar.</p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">4. Funcionamento e Disponibilidade</h2>
              <p>Nos esforçamos para manter o serviço no ar, mas o Backblog pode passar por:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>atualizações;</li>
                <li>melhorias;</li>
                <li>manutenções;</li>
                <li>instabilidades temporárias.</li>
              </ul>
              <p>Não garantimos disponibilidade contínua.</p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">5. Conduta Proibida</h2>
              <p>O usuário concorda em não:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>tentar invadir sistemas;</li>
                <li>prejudicar o serviço ou outros usuários;</li>
                <li>automatizar ações de forma abusiva;</li>
                <li>tentar acessar dados que não pertencem à sua conta.</li>
              </ul>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">6. Encerramento de Conta</h2>
              <p>Você pode excluir sua conta quando quiser. Em situações de violação grave dos termos, o Backblog pode suspender ou encerrar contas.</p>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">7. Limitação de Responsabilidade</h2>
              <p>O Backblog não é responsável por:</p>
              <ul className="list-disc space-y-1 pl-6 text-slate-300">
                <li>perdas de dados ocasionadas por falhas externas;</li>
                <li>decisões tomadas com base no conteúdo publicado pelo usuário;</li>
                <li>danos indiretos, incidentais ou consequentes.</li>
              </ul>
            </article>

            <article className="space-y-2">
              <h2 className="text-lg font-semibold text-white">8. Alterações dos Termos</h2>
              <p>Podemos atualizar estes termos a qualquer momento. Alterações relevantes serão comunicadas na plataforma.</p>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
