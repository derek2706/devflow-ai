"use client";
import { useEffect, useId, useRef } from "react";
import styles from "./ui.module.css";
import { cx } from "../../lib/class-names";
import { Icon } from "./icon";

let modalCount = 0;
let originalBodyOverflow = "";

export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const heading = useId();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    if (modalCount === 0) originalBodyOverflow = document.body.style.overflow;
    modalCount += 1;
    document.body.style.overflow = "hidden";
    const root = ref.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== root) return;
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const elements = focusable();
        if (!elements.length) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === elements[0]) {
          event.preventDefault();
          elements.at(-1)?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === elements.at(-1)
        ) {
          event.preventDefault();
          elements[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      modalCount -= 1;
      if (modalCount === 0) document.body.style.overflow = originalBodyOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={styles["modal-backdrop"]}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cx(styles["modal"], wide ? styles["wide"] : undefined)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading}
        ref={ref}
      >
        <div className={styles["modal-header"]}>
          <div>
            <h2 className={styles["native-h2"]} id={heading}>
              {title}
            </h2>
            {description && <p className={styles["native-p"]}>{description}</p>}
          </div>
          <button
            className={cx(styles["native-button"], styles["icon-button"])}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
