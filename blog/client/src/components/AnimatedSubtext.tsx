"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const SUBTEXTS = [
  "Organizando pensamentos…",
  "Capturando ideias…",
  "Processando o dia…",
  "Arquivando memórias…",
  "Ligando pontos…",
  "Registrando sua evolução…",
  "Guardando o importante…",
  "Transformando caos em clareza…",
  "Criando seu mapa mental…",
  "Observando padrões…",
  "Entendendo como você pensa…",
  "Montando sua linha do tempo…",
  "Aprendendo com seus registros…",
  "Acompanhei você ontem. Continuamos?",
  "Tudo que você escreve aqui importa…",
  "Detectando novos insights…",
  "Lendo sua mente (quase isso)…",
  "É aqui que sua criatividade respira…",
  "Escreva um pouco sobre hoje.",
  "O que você aprendeu hoje?",
  "Como você está se sentindo agora?",
  "Alguma ideia te encontrou hoje?",
  "Quanto mais você escreve, mais clareza ganha.",
  "Pequenos registros, grandes evoluções.",
  "Um pensamento por dia basta.",
  "O futuro vai agradecer esse registro.",
  "Eu fico mais inteligente quando você escreve.",
  "Sua mente é mais interessante do que você imagina.",
  "Bora organizar esse caos mental?",
  "Idea incoming…",
  "Voltando para o modo cérebro…",
  "Mais um capítulo do seu dia.",
] as const;

const TYPING_SPEED = 55;
const ERASING_SPEED = 28;
const HOLD_DURATION = 1600;
const THINKING_DURATION = 1400;

type Phase = "typing" | "erasing" | "thinking";

export default function AnimatedSubtext() {
  const [phase, setPhase] = useState<Phase>("typing");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");

  const currentPhrase = useMemo(() => SUBTEXTS[phraseIndex] ?? "", [phraseIndex]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (phase === "typing") {
      if (displayText.length < currentPhrase.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        }, TYPING_SPEED);
      } else {
        timeout = setTimeout(() => {
          setPhase("erasing");
        }, HOLD_DURATION);
      }
    } else if (phase === "erasing") {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText((prev) => prev.slice(0, -1));
        }, ERASING_SPEED);
      } else {
        setPhase("thinking");
      }
    } else if (phase === "thinking") {
      timeout = setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % SUBTEXTS.length);
        setPhase("typing");
      }, THINKING_DURATION);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [currentPhrase, displayText.length, phase]);

  return (
    <div className="min-h-[48px] text-sm text-slate-300" aria-live="polite">
      {phase === "thinking" ? (
        <ThinkingIndicator />
      ) : (
        <motion.span
          key={currentPhrase}
          className="inline-flex items-center"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {displayText}
          <Caret />
        </motion.span>
      )}
    </div>
  );
}

function Caret() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-1 inline-block h-4 w-0.5 bg-emerald-400"
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
      <span>thinking</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-emerald-300"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 1, repeat: Infinity, delay: index * 0.2, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}
