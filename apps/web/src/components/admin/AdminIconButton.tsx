"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { DashboardIcon } from "@/components/layout/DashboardIcons";
import type { DashboardIconName } from "@/components/layout/DashboardIcons";

import styles from "./AdminActions.module.css";

export type AdminActionType =
  | "view"
  | "edit"
  | "delete"
  | "download"
  | "rollback"
  | "publish"
  | "duplicate"
  | "open"
  | "sync";

export type AdminActionTone = "neutral" | "primary" | "danger" | "warning";

const ACTION_ICONS: Record<AdminActionType, DashboardIconName> = {
  view: "web",
  edit: "plan",
  delete: "close",
  download: "inbox",
  rollback: "history",
  publish: "cta",
  duplicate: "summary",
  open: "chevron-right",
  sync: "sync",
};

type SharedProps = {
  action: AdminActionType;
  label: string;
  tone?: AdminActionTone;
  disabled?: boolean;
  children?: ReactNode;
};

type ButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
    href?: never;
  };

type LinkProps = SharedProps & {
  href: string;
};

export type AdminIconButtonProps = ButtonProps | LinkProps;

function getClassName(tone: AdminActionTone = "neutral") {
  return `${styles.iconButton} ${styles[`iconButton_${tone}`]}`;
}

export default function AdminIconButton(props: AdminIconButtonProps) {
  const { action, label, tone = "neutral", disabled, children } = props;
  const icon = ACTION_ICONS[action];
  const content = (
    <>
      <DashboardIcon name={icon} className={styles.icon} />
      <span className={styles.srLabel}>{children ?? label}</span>
    </>
  );

  if ("href" in props) {
    if (disabled) {
      return (
        <span
          className={getClassName(tone)}
          aria-disabled="true"
          aria-label={label}
          title={label}
        >
          {content}
        </span>
      );
    }

    return (
      <Link
        href={props.href}
        className={getClassName(tone)}
        aria-label={label}
        title={label}
      >
        {content}
      </Link>
    );
  }

  const { type = "button", ...buttonProps } = props;

  return (
    <button
      {...buttonProps}
      type={type}
      className={getClassName(tone)}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {content}
    </button>
  );
}
