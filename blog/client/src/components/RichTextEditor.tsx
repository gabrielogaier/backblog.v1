"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import clsx from "clsx";
import markdownProfile from "@/config/markdownProfile.json";

type Props = {
  value: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  onUploadImage?: (file: File) => Promise<string>;
};

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type ToolbarButton =
  | { label: string; action: "toggleHeading"; args: { level: HeadingLevel } }
  | {
      label: string;
      action:
        | "toggleBold"
        | "toggleItalic"
        | "toggleStrike"
        | "toggleCode"
        | "toggleBulletList"
        | "toggleOrderedList"
        | "toggleBlockquote"
        | "toggleCodeBlock"
        | "insertTable"
        | "addRowAfter"
        | "addColumnAfter"
        | "deleteTable";
    };

const configuredHeadingLevels = (markdownProfile.headings?.allowedLevels ?? [2, 3])
  .filter((level): level is number => Number.isInteger(level) && level >= 1 && level <= 6)
  .map((level) => level as HeadingLevel);

const headingLevels: HeadingLevel[] = configuredHeadingLevels.length ? configuredHeadingLevels : [2, 3];
const tablesEnabled = Boolean(markdownProfile.tables?.enabled);
const tableToolbarLabels = {
  insert: markdownProfile.tables?.toolbar?.insertLabel || "Tbl",
  addRow: markdownProfile.tables?.toolbar?.addRowLabel || "+L",
  addColumn: markdownProfile.tables?.toolbar?.addColumnLabel || "+C",
  delete: markdownProfile.tables?.toolbar?.deleteLabel || "Del Tbl",
};
const defaultTableRows = Number(markdownProfile.tables?.defaultRows) > 1 ? Number(markdownProfile.tables?.defaultRows) : 3;
const defaultTableCols = Number(markdownProfile.tables?.defaultCols) > 1 ? Number(markdownProfile.tables?.defaultCols) : 3;
const withHeaderRow = markdownProfile.tables?.withHeaderRow !== false;

const toolbarButtons: ToolbarButton[] = [
  ...headingLevels.map((level) => ({
    label: `H${level}`,
    action: "toggleHeading" as const,
    args: { level },
  })),
  { label: "B", action: "toggleBold" },
  { label: "I", action: "toggleItalic" },
  { label: "S", action: "toggleStrike" },
  { label: markdownProfile.inlineCode?.toolbarLabel || "</>", action: "toggleCode" },
  { label: "•", action: "toggleBulletList" },
  { label: "1.", action: "toggleOrderedList" },
  { label: "❝", action: "toggleBlockquote" },
  { label: markdownProfile.codeBlock?.toolbarLabel || "{ }", action: "toggleCodeBlock" },
  ...(tablesEnabled
    ? [
        { label: tableToolbarLabels.insert, action: "insertTable" as const },
        { label: tableToolbarLabels.addRow, action: "addRowAfter" as const },
        { label: tableToolbarLabels.addColumn, action: "addColumnAfter" as const },
        { label: tableToolbarLabels.delete, action: "deleteTable" as const },
      ]
    : []),
];

export function RichTextEditor({ value, onChange, placeholder, readOnly, onUploadImage }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editor = useEditor({
    editable: !readOnly,
    content: value || "",
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: headingLevels,
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Comece a escrever seu post...",
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "rounded-xl my-4 shadow border border-slate-800 max-w-full",
        },
      }),
      ...(tablesEnabled
        ? [
            Table.configure({
              resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
          ]
        : []),
    ],
    onUpdate({ editor: instance }) {
      onChange?.(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const nextValue = value || "";
    if (current !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [value, editor]);

  const handleToolbarClick = useCallback(
    (button: ToolbarButton) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      switch (button.action) {
        case "toggleHeading":
          chain.toggleHeading({ level: button.args.level }).run();
          break;
        case "toggleBold":
          chain.toggleBold().run();
          break;
        case "toggleItalic":
          chain.toggleItalic().run();
          break;
        case "toggleStrike":
          chain.toggleStrike().run();
          break;
        case "toggleCode":
          chain.toggleCode().run();
          break;
        case "toggleBulletList":
          chain.toggleBulletList().run();
          break;
        case "toggleOrderedList":
          chain.toggleOrderedList().run();
          break;
        case "toggleBlockquote":
          chain.toggleBlockquote().run();
          break;
        case "toggleCodeBlock":
          chain.toggleCodeBlock().run();
          break;
        case "insertTable":
          chain
            .insertTable({
              rows: defaultTableRows,
              cols: defaultTableCols,
              withHeaderRow,
            })
            .run();
          break;
        case "addRowAfter":
          chain.addRowAfter().run();
          break;
        case "addColumnAfter":
          chain.addColumnAfter().run();
          break;
        case "deleteTable":
          chain.deleteTable().run();
          break;
        default:
          break;
      }
    },
    [editor],
  );

  const isButtonActive = useCallback(
    (button: ToolbarButton) => {
      if (!editor) return false;
      switch (button.action) {
        case "toggleHeading":
          return editor.isActive("heading", { level: button.args.level });
        case "toggleBold":
          return editor.isActive("bold");
        case "toggleItalic":
          return editor.isActive("italic");
        case "toggleStrike":
          return editor.isActive("strike");
        case "toggleCode":
          return editor.isActive("code");
        case "toggleBulletList":
          return editor.isActive("bulletList");
        case "toggleOrderedList":
          return editor.isActive("orderedList");
        case "toggleBlockquote":
          return editor.isActive("blockquote");
        case "toggleCodeBlock":
          return editor.isActive("codeBlock");
        case "insertTable":
        case "addRowAfter":
        case "addColumnAfter":
        case "deleteTable":
          return editor.isActive("table");
        default:
          return false;
      }
    },
    [editor],
  );

  const handleUploadClick = useCallback(() => {
    if (readOnly || !onUploadImage) return;
    fileInputRef.current?.click();
  }, [readOnly, onUploadImage]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!editor || !onUploadImage || !event.target.files?.length) return;
      const file = event.target.files[0];
      event.target.value = "";
      try {
        setUploading(true);
        const uploaded = await onUploadImage(file);
        editor.chain().focus().setImage({ src: uploaded }).run();
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
      }
    },
    [editor, onUploadImage],
  );

  const toolbar = useMemo(() => {
    if (!editor) return null;
    const requiresTableSelection = new Set<ToolbarButton["action"]>(["addRowAfter", "addColumnAfter", "deleteTable"]);
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2">
        {toolbarButtons.map((button) => (
          <button
            key={button.label}
            type="button"
            onClick={() => handleToolbarClick(button)}
            disabled={readOnly || (requiresTableSelection.has(button.action) && !editor.isActive("table"))}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              "border border-transparent text-slate-300 hover:border-emerald-400/60 hover:text-emerald-300",
              isButtonActive(button) && "border-emerald-400/80 bg-emerald-500/15 text-emerald-200",
            )}
          >
            {button.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={
              readOnly ||
              !(editor && editor.can().chain().focus().undo().run())
            }
            className="rounded-full border border-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={
              readOnly ||
              !(editor && editor.can().chain().focus().redo().run())
            }
            className="rounded-full border border-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 disabled:opacity-40"
          >
            Redo
          </button>
          {onUploadImage && (
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={readOnly || uploading}
              className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 disabled:opacity-50"
            >
              {uploading ? "Enviando..." : "Imagem"}
            </button>
          )}
        </div>
      </div>
    );
  }, [editor, handleToolbarClick, handleUploadClick, isButtonActive, onUploadImage, readOnly, uploading]);

  return (
    <div className="space-y-3">
      {toolbar}
      <EditorContent editor={editor} className="rounded-3xl border border-slate-900 bg-slate-900/60 p-4" />
      {onUploadImage && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
    </div>
  );
}
