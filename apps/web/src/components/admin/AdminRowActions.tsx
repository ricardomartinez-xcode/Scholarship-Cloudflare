"use client";

import AdminIconButton from "./AdminIconButton";
import type {
  AdminActionTone,
  AdminActionType,
} from "./AdminIconButton";
import styles from "./AdminActions.module.css";

export type AdminRowAction = {
  type: AdminActionType;
  label: string;
  href?: string;
  tone?: AdminActionTone;
  disabled?: boolean;
  onClick?: () => void;
};

export default function AdminRowActions({
  actions,
  label = "Acciones de fila",
}: {
  actions: AdminRowAction[];
  label?: string;
}) {
  return (
    <div className={styles.rowActions} aria-label={label}>
      {actions.map((action) => {
        const key = `${action.type}-${action.label}`;

        if (action.href) {
          return (
            <AdminIconButton
              key={key}
              action={action.type}
              label={action.label}
              href={action.href}
              tone={action.tone}
              disabled={action.disabled}
            />
          );
        }

        return (
          <AdminIconButton
            key={key}
            action={action.type}
            label={action.label}
            tone={action.tone}
            disabled={action.disabled}
            onClick={action.onClick}
          />
        );
      })}
    </div>
  );
}
