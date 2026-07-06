"use client";

import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
} from "lucide-react";

interface RichTextEditorProps {
  /** Bump this to reseed the editor content from `html` (e.g. when a template is applied). */
  seedKey: number;
  /** HTML used to seed the editor whenever seedKey changes. */
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// Lightweight contentEditable editor with a basic formatting toolbar. execCommand
// is deprecated but still universally supported and is the simplest fit for an
// internal admin tool without pulling in a full editor dependency.
export function RichTextEditor({
  seedKey,
  html,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
    // Only reseed when seedKey changes (template applied / reset), never on keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }

  const btn =
    "h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground";

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <button type="button" className={btn} title="Bold" onClick={() => exec("bold")}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Italic" onClick={() => exec("italic")}>
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn}
          title="Underline"
          onClick={() => exec("underline")}
        >
          <Underline className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          className={btn}
          title="Bulleted list"
          onClick={() => exec("insertUnorderedList")}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={btn}
          title="Numbered list"
          onClick={() => exec("insertOrderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button type="button" className={btn} title="Insert link" onClick={addLink}>
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        data-placeholder={placeholder}
        className="min-h-[220px] px-3 py-2 text-sm leading-relaxed outline-none [&:empty]:before:text-muted-foreground [&:empty]:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
