"use client";

import { useId, useState } from "react";

export default function PasswordField({
  name,
  label,
  placeholder,
  inputClassName,
  autoComplete,
}: {
  name: string;
  label: string;
  placeholder?: string;
  inputClassName: string;
  autoComplete?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-2 text-sm" htmlFor={id}>
      {label}
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          className={[inputClassName, "pr-11"].join(" ")}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contrasena" : "Mostrar contrasena"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-transparent text-slate-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(31,108,140,0.3)]"
        >
          {visible ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2.8 2.8 0 0 0 3.9 3.9" />
              <path d="M9.9 5.1A10.5 10.5 0 0 1 12 4.8c6.3 0 10.6 7.2 10.6 7.2a18.2 18.2 0 0 1-3.2 4.2" />
              <path d="M6.4 6.4A18.2 18.2 0 0 0 1.4 12S5.7 19.2 12 19.2c1 0 2-.2 2.9-.5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M1.4 12S5.7 4.8 12 4.8 22.6 12 22.6 12 18.3 19.2 12 19.2 1.4 12 1.4 12Z" />
              <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}
