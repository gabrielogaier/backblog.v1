export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 px-6 py-16">
      <div className="max-w-2xl space-y-6 rounded-3xl border border-slate-900 bg-slate-900/70 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Em breve</p>
        <h1 className="text-3xl font-semibold text-white">Liberação de novos usuários</h1>
        <p className="text-sm text-slate-300">
          Estamos preparando um fluxo de autoatendimento para que você possa convidar colaboradores, definir workspaces
          e liberar acesso à criação de conteúdos orientados pela IA. Enquanto isso, deixe seu e-mail que avisaremos assim
          que essa etapa estiver pronta.
        </p>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Ops? Ainda não tem conta? Aguarde um pouco.</p>
      </div>
    </div>
  );
}
