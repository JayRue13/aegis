"use client";

import { useRef, useState } from "react";
import { Modal, buttonClass, inputClass } from "./Modal";
import { cn } from "@/lib/util";

export interface Health {
  status: string;
  version: string;
  auth: "supabase" | "access-code" | "open" | "locked";
  providers: string[];
  demo: boolean;
}

export type Theme = "system" | "dark" | "light";

export function SettingsPanel({
  health,
  supabaseEnabled,
  userEmail,
  onSignIn,
  onOAuth,
  oauthProviders,
  onSignOut,
  onCopyLocalToCloud,
  accessCode,
  onAccessCode,
  userName,
  onUserName,
  theme,
  onTheme,
  onExport,
  onImport,
  onClose,
}: {
  health: Health | null;
  supabaseEnabled: boolean;
  userEmail: string | null;
  onSignIn: (email: string) => Promise<string>;
  onOAuth: (provider: string) => void;
  oauthProviders: string[];
  onSignOut: () => void;
  onCopyLocalToCloud: () => Promise<string>;
  accessCode: string;
  onAccessCode: (code: string) => void;
  userName: string;
  onUserName: (name: string) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onExport: () => void;
  onImport: (file: File) => Promise<string>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [dataMsg, setDataMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="space-y-7">
        {supabaseEnabled && (
          <Section title="Account">
            {userEmail ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Signed in as <span className="font-medium">{userEmail}</span>. Your chats sync across devices.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`${buttonClass} border border-line hover:bg-surface-2`}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setAuthMsg(await onCopyLocalToCloud());
                      setBusy(false);
                    }}
                  >
                    Copy chats from this device to my account
                  </button>
                  <button className={`${buttonClass} text-danger hover:bg-danger/10`} onClick={onSignOut}>
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setAuthMsg(await onSignIn(email));
                    setBusy(false);
                  }}
                >
                  <input
                    className={inputClass}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-label="Email"
                  />
                  <button className={`${buttonClass} btn-accent shrink-0`} disabled={busy}>
                    Email me a link
                  </button>
                </form>
                {oauthProviders.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {oauthProviders.map((p) => (
                      <button
                        key={p}
                        className={`${buttonClass} border border-line capitalize hover:bg-surface-2`}
                        onClick={() => onOAuth(p)}
                      >
                        Continue with {p}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-faint">Until you sign in, chats are saved only in this browser.</p>
              </div>
            )}
            {authMsg && <p className="mt-2 text-sm text-muted">{authMsg}</p>}
          </Section>
        )}

        {health?.auth === "access-code" && (
          <Section title="Access code" hint="This AEGIS server is protected by a shared code.">
            <input
              className={inputClass}
              type="password"
              value={accessCode}
              onChange={(e) => onAccessCode(e.target.value)}
              placeholder="Access code"
              aria-label="Access code"
            />
          </Section>
        )}

        <Section title="Personalization">
          <label className="block space-y-1.5">
            <span className="text-sm text-muted">What should AEGIS call you?</span>
            <input
              className={inputClass}
              value={userName}
              onChange={(e) => onUserName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
            />
          </label>
          <div className="mt-4">
            <span className="block text-sm text-muted">Theme</span>
            <div className="mt-1.5 inline-flex rounded-xl border border-line bg-surface-2 p-1">
              {(["system", "dark", "light"] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onTheme(t)}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-sm capitalize transition",
                    theme === t ? "bg-surface text-fg shadow" : "text-muted hover:text-fg",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Your data" hint="Export everything as JSON, or import a backup.">
          <div className="flex flex-wrap gap-2">
            <button className={`${buttonClass} border border-line hover:bg-surface-2`} onClick={onExport}>
              Export
            </button>
            <button
              className={`${buttonClass} border border-line hover:bg-surface-2`}
              onClick={() => importRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setDataMsg(await onImport(f));
              }}
            />
          </div>
          {dataMsg && <p className="mt-2 text-sm text-muted">{dataMsg}</p>}
        </Section>

        <Section title="Server status">
          {health ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted">Model providers</dt>
              <dd>{health.providers.length ? health.providers.join(", ") : "none (demo mode)"}</dd>
              <dt className="text-muted">Sign-in</dt>
              <dd>
                {
                  {
                    supabase: "Supabase accounts",
                    "access-code": "Shared access code",
                    open: "Open (development)",
                    locked: "Locked: configure sign-in",
                  }[health.auth]
                }
              </dd>
              <dt className="text-muted">Version</dt>
              <dd>{health.version}</dd>
            </dl>
          ) : (
            <p className="text-sm text-faint">Checking…</p>
          )}
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
