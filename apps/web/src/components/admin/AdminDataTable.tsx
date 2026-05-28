import type { ReactNode } from "react";

import styles from "./AdminDataTable.module.css";

export default function AdminDataTable({
  title,
  count,
  description,
  children,
  maxHeight = "min(70dvh, 760px)",
}: {
  title?: string;
  count?: number;
  description?: string;
  children: ReactNode;
  maxHeight?: string;
}) {
  return (
    <section className={styles.shell}>
      {title || typeof count === "number" || description ? (
        <div className={styles.header}>
          <div>
            {title ? <h3 className={styles.title}>{title}</h3> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {typeof count === "number" ? (
            <span className={styles.count}>{count} registros</span>
          ) : null}
        </div>
      ) : null}
      <div className={styles.viewport} style={{ maxHeight }}>
        {children}
      </div>
    </section>
  );
}
