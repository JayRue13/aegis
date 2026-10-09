"use client";

import { useEffect, useRef, useState } from "react";
import type { FileContext, ImagePart, ModelInfo } from "@/lib/types";
import { imageToDataUrl, isDocumentFile, isImageFile, isTextFile } from "@/lib/chat-client";
import { IconClip, IconFile, IconSend, IconStop, IconX } from "./Icons";
import { ModelPicker } from "./ModelPicker";
import { cn } from "@/lib/util";

const MAX_TEXT_FILE = 400_000;

export interface ComposerSubmit {
  text: string;
  images: ImagePart[];
  files: FileContext[];
}

export function Composer({
  onSend,
  onStop,
  streaming,
  models,
  model,
  onModelChange,
  disabled,
  autoFocusKey,
  onExtract,
}: {
  onSend: (input: ComposerSubmit) => void;
  onStop: () => void;
  streaming: boolean;
  models: ModelInfo[];
  model: string | null;
  onModelChange: (id: string) => void;
  disabled?: boolean;
  autoFocusKey?: string | null;
  onExtract: (file: File) => Promise<FileContext>;
}) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImagePart[]>([]);
  const [files, setFiles] = useState<FileContext[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const supportsVision = models.find((m) => m.id === model)?.vision ?? false;

  useEffect(() => {
    ta.current?.focus();
  }, [autoFocusKey]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  }, [text]);

  async function addFiles(list: FileList | File[]) {
    setNotice(null);
    for (const f of Array.from(list)) {
      if (isImageFile(f)) {
        if (images.length >= 4) {
          setNotice("Up to 4 images per message.");
          continue;
        }
        try {
          const dataUrl = await imageToDataUrl(f);
          setImages((prev) => [...prev, { type: "image" as const, dataUrl, name: f.name }].slice(0, 4));
        } catch {
          setNotice(`Couldn't read ${f.name}.`);
        }
      } else if (isDocumentFile(f)) {
        if (f.size > 4 * 1024 * 1024) {
          setNotice(`${f.name} is larger than 4 MB.`);
          continue;
        }
        setReading((n) => n + 1);
        try {
          const doc = await onExtract(f);
          setFiles((prev) => [...prev, doc].slice(0, 10));
        } catch (err) {
          setNotice((err as Error).message);
        } finally {
          setReading((n) => n - 1);
        }
      } else if (isTextFile(f)) {
        const content = await f.text();
        if (content.length > MAX_TEXT_FILE) setNotice(`${f.name} is large; only the first part will be used.`);
        setFiles((prev) => [...prev, { name: f.name, text: content.slice(0, MAX_TEXT_FILE) }].slice(0, 10));
      } else {
        setNotice(`${f.name}: supported files are PDF, Word, text, code and images.`);
      }
    }
  }

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && images.length === 0 && files.length === 0) || streaming || disabled || reading > 0) return;
    onSend({ text: trimmed, images, files });
    setText("");
    setImages([]);
    setFiles([]);
    setNotice(null);
  }

  const canSend = !disabled && reading === 0 && (text.trim().length > 0 || images.length > 0 || files.length > 0);

  return (
    <div
      className={cn(
        "glass relative rounded-[1.6rem] border border-line-strong shadow-[var(--shadow)] transition focus-within:border-accent/45",
        dragging && "border-accent ring-4 ring-accent/15",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      {(images.length > 0 || files.length > 0 || reading > 0) && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {images.map((img, i) => (
            <div key={i} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={img.name ?? ""}
                className="h-16 w-16 rounded-xl border border-line object-cover"
              />
              <RemoveChip onClick={() => setImages((p) => p.filter((_, j) => j !== i))} />
            </div>
          ))}
          {files.map((f, i) => (
            <div
              key={i}
              className="relative flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 py-2 pl-2.5 pr-7 text-xs text-muted"
            >
              <IconFile width={14} height={14} />
              <span className="max-w-40 truncate">{f.name}</span>
              <RemoveChip onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} />
            </div>
          ))}
          {reading > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-2.5 py-2 text-xs text-faint">
              Reading document…
            </div>
          )}
        </div>
      )}
      {images.length > 0 && !supportsVision && (
        <p className="px-5 pt-2 text-xs text-faint">
          The selected model may not support images. Pick one tagged “vision”.
        </p>
      )}
      <textarea
        ref={ta}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.files);
          if (pasted.length) {
            e.preventDefault();
            addFiles(pasted);
          }
        }}
        rows={1}
        placeholder="Message AEGIS"
        aria-label="Message"
        className="block max-h-[260px] w-full resize-none bg-transparent px-5 pb-1 pt-4 text-[0.97rem] leading-relaxed outline-none placeholder:text-faint focus-visible:outline-none"
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label="Attach files"
            title="Attach PDF, Word, text, code or image files"
          >
            <IconClip />
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <ModelPicker models={models} value={model} onChange={onModelChange} disabled={streaming} />
        </div>
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-bg transition hover:opacity-85"
            aria-label="Stop generating"
          >
            <IconStop width={16} height={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="btn-accent flex h-9 w-9 items-center justify-center rounded-full transition hover:brightness-110 disabled:opacity-35"
            aria-label="Send message"
          >
            <IconSend width={17} height={17} />
          </button>
        )}
      </div>
      {notice && <p className="px-5 pb-3 text-xs text-muted">{notice}</p>}
    </div>
  );
}

function RemoveChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove attachment"
      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-muted shadow hover:text-fg"
    >
      <IconX width={11} height={11} />
    </button>
  );
}
