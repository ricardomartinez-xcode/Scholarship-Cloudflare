"use client";

import { useState } from "react";

export default function PasswordField({
  name,
  placeholder,
  autoComplete,
  className,
  minLength,
  maxLength,
  required = false,
}: {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={className}
        minLength={minLength}
        maxLength={maxLength}
        required={required}
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((prev) => !prev)}
        aria-label={label}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--ui-text-secondary)] transition hover:text-[color:var(--ui-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(31,108,140,0.3)]"
      >
        {visible ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M3 3l18 18" />
            <path d="M10.7 10.7a3 3 0 0 0 4.2 4.2" />
            <path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c6 0 9.5 6 9.5 6a16.7 16.7 0 0 1-4 4.8" />
            <path d="M6.6 6.6A16.4 16.4 0 0 0 2.5 10s3.5 6 9.5 6a9.7 9.7 0 0 0 3.4-.6" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M2.5 10s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
