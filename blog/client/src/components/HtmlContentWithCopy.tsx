"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

type HtmlContentWithCopyProps = {
  html: string;
  className?: string;
  style?: CSSProperties;
};

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapToken(value: string, colorVar: string) {
  return `<span style="color: var(${colorVar});">${value}</span>`;
}

function indexToAlphaId(index: number) {
  let value = index + 1;
  let out = "";
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode(97 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}

function highlightCodeToHtml(text: string) {
  const escaped = escapeHtml(text);
  const tokens = new Map<string, string>();
  const markerFor = (value: string, colorVar: string) => {
    const id = indexToAlphaId(tokens.size);
    const marker = `\u0000BBTOKEN_${id}\u0000`;
    tokens.set(id, wrapToken(value, colorVar));
    return marker;
  };

  let working = escaped
    .replace(/\/\*[\s\S]*?\*\//g, (match) => markerFor(match, "--post-code-token-comment"))
    .replace(/\/\/[^\n]*/g, (match) => markerFor(match, "--post-code-token-comment"))
    .replace(/(^|\s)#([^\n]*)/gm, (_match, prefix: string, comment: string) => `${prefix}${markerFor(`#${comment}`, "--post-code-token-comment")}`)
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, (match) => markerFor(match, "--post-code-token-string"));

  working = working
    .replace(
      /\b(await|async|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|switch|throw|try|typeof|var|void|while|with|yield|true|false|null|undefined)\b/g,
      (match) => markerFor(match, "--post-code-token-keyword"),
    )
    .replace(/\b\d+(?:\.\d+)?\b/g, (match) => markerFor(match, "--post-code-token-number"))
    .replace(/\b([A-Za-z_$][\w$]*)(?=\s*\()/g, (match) => markerFor(match, "--post-code-token-function"));

  return working.replace(/\u0000BBTOKEN_([a-z]+)\u0000/g, (_match, id: string) => tokens.get(id) ?? "");
}

export function HtmlContentWithCopy({ html, className, style }: HtmlContentWithCopyProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const cleanups: Array<() => void> = [];

    const ensureCopyButtons = () => {
      const highlightCodeNode = (node: HTMLElement) => {
        if (node.dataset.bbHighlighted === "1") {
          return;
        }
        const rawCode = node.textContent ?? "";
        if (!rawCode.trim()) {
          node.dataset.bbHighlighted = "1";
          return;
        }
        node.innerHTML = highlightCodeToHtml(rawCode);
        node.dataset.bbHighlighted = "1";
      };

      const blocks = Array.from(root.querySelectorAll("pre"));
      blocks.forEach((block) => {
        const codeNode = block.querySelector("code");
        if (codeNode instanceof HTMLElement) {
          codeNode.dataset.codeVariant = "block";
          highlightCodeNode(codeNode);
        }

        if (block.querySelector('button[data-copy-code="true"]')) {
          return;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.copyCode = "true";
        button.setAttribute("aria-label", "Copiar código");
        button.textContent = "⧉ Copiar";
        button.style.position = "absolute";
        button.style.top = "0.5rem";
        button.style.right = "0.5rem";
        button.style.border = "1px solid var(--post-code-copy-border, rgba(148, 163, 184, 0.45))";
        button.style.borderRadius = "9999px";
        button.style.padding = "0.22rem 0.7rem";
        button.style.fontSize = "0.72rem";
        button.style.fontWeight = "600";
        button.style.background = "var(--post-code-copy-bg, rgba(15, 23, 42, 0.88))";
        button.style.color = "var(--post-code-copy-text, rgb(226, 232, 240))";
        button.style.cursor = "pointer";
        button.style.lineHeight = "1.2";
        button.style.display = "inline-flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        button.style.zIndex = "20";

        if (!block.style.position) {
          block.style.position = "relative";
        }
        if (!block.style.paddingTop) {
          block.style.paddingTop = "2.2rem";
        }

        const onClick = async () => {
          const codeText = block.querySelector("code")?.textContent ?? block.textContent ?? "";
          if (!codeText.trim()) return;

          let copied = false;
          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(codeText);
              copied = true;
            } catch {
              copied = false;
            }
          }

          if (!copied) {
            copied = fallbackCopy(codeText);
          }

          const previousLabel = button.textContent;
          button.textContent = copied ? "✓ Copiado" : "Falha";
          window.setTimeout(() => {
            button.textContent = previousLabel ?? "⧉ Copiar";
          }, 1600);
        };

        button.addEventListener("click", onClick);
        block.appendChild(button);
        cleanups.push(() => {
          button.removeEventListener("click", onClick);
          button.remove();
        });
      });

      const inlineCodes = Array.from(root.querySelectorAll("code"));
      inlineCodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.closest("pre")) return;
        node.dataset.codeVariant = "inline";
        highlightCodeNode(node);
      });
    };

    ensureCopyButtons();
    const observer = new MutationObserver(() => {
      ensureCopyButtons();
    });
    observer.observe(root, { childList: true, subtree: true });
    cleanups.push(() => observer.disconnect());

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [html]);

  return <div ref={containerRef} className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
