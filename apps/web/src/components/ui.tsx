"use client";
import styles from "./ui.module.css";
import { cx } from "../lib/class-names";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, ApiError, errorText } from "../lib/api";

export const SessionExpiredContext = createContext<(() => void) | null>(null);

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    folder: (
      <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    down: <path d="m6 9 6 6 6-6" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
        <path d="M20 2v4M18 4h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    circle: <circle cx="12" cy="12" r="8" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 4 3-2 1-3 4-1v-4l-3-2-1-4-4-1-3 1Z" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
    edit: (
      <>
        <path d="m4 16 12-12 4 4L8 20H4v-4ZM14 6l4 4" />
      </>
    ),
    board: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 3v18M15 3v18M6 7v4M12 7v8M18 7v3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 11h18" />
      </>
    ),
    chat: <path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    activity: <path d="M2 12h5l3-8 4 16 3-8h5" />,
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(styles["native-svg"], className)}
    >
      {paths[name] || paths.folder}
    </svg>
  );
}

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cx(styles["brand"], className)}>
      <span className={styles["brand-mark"]}>
        <svg
          className={styles["native-svg"]}
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m7 6 8 8-8 8M15 6l8 8-8 8"
            stroke="currentColor"
            strokeWidth="3.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          devflow<span className={styles["brand-ai"]}>AI</span>
        </span>
      )}
    </span>
  );
}
export function Avatar({
  name,
  size = "normal",
  className,
}: {
  name?: string;
  size?: "small" | "normal" | "large";
  className?: string;
}) {
  return (
    <span
      title={name || "Unassigned"}
      className={cx(
        styles["avatar"],
        size !== "normal" && styles[size],
        className,
      )}
    >
      {name
        ? name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "?"}
    </span>
  );
}
export function ErrorBanner({
  error,
  className,
}: {
  error?: string | null;
  className?: string;
}) {
  return error ? (
    <div
      className={cx(styles["notice"], styles["error"], className)}
      role="alert"
    >
      {error}
    </div>
  ) : null;
}
export function SuccessBanner({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  return message ? (
    <div
      className={cx(styles["notice"], styles["success"], className)}
      role="status"
    >
      <Icon name="check" size={17} />
      {message}
    </div>
  ) : null;
}
export function Loading({
  label = "Loading your workspace…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cx(styles["loading"], className)} role="status">
      <span className={styles["spinner"]} />
      {label}
    </div>
  );
}
export function ContentSkeleton({
  label = "Loading your workspace…",
  heading = true,
}: {
  label?: string;
  heading?: boolean;
}) {
  return (
    <div className={styles["content-skeleton"]} role="status" aria-busy="true">
      <span className={styles["sr-only"]}>{label}</span>
      <div aria-hidden="true">
        {heading && (
          <div className={styles["skeleton-heading"]}>
            <span />
            <span />
          </div>
        )}
        <div className={styles["skeleton-grid"]}>
          {[0, 1, 2].map((item) => (
            <div className={styles["skeleton-card"]} key={item}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export function Empty({
  icon = "folder",
  title,
  description,
  children,
  className,
}: {
  icon?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(styles["empty"], className)}>
      <span className={styles["empty-icon"]}>
        <Icon name={icon} size={26} />
      </span>
      <h3 className={styles["native-h3"]}>{title}</h3>
      <p className={styles["native-p"]}>{description}</p>
      {children}
    </div>
  );
}
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
export function useResource<T>(path: string | null) {
  const onSessionExpired = useContext(SessionExpiredContext);
  const [revision, setRevision] = useState(0);
  // A new request identity prevents a previous visit's error/loading state from
  // flashing when a resource changes from A to B and back to A.
  const request = useMemo(() => ({ path, revision }), [path, revision]);
  const [state, setState] = useState<{
    request?: typeof request;
    data?: T;
    error?: string;
  }>({});
  useEffect(() => {
    const controller = new AbortController();
    if (!path) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setState({});
      });
      return () => controller.abort();
    }
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ request, data });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          onSessionExpired?.();
        setState({ request, error: errorText(error) });
      });
    return () => controller.abort();
  }, [path, request, onSessionExpired]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return {
    data: path && state.request?.path === path ? state.data : undefined,
    error: state.request === request ? state.error : undefined,
    loading: !!path && state.request !== request,
    refresh,
  };
}
export function dateLabel(value?: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
export function timeAgo(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
}
export function PriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        styles["priority"],
        styles[priority.toLowerCase()],
        className,
      )}
    >
      <span>
        {priority === "URGENT"
          ? "!"
          : priority === "HIGH"
            ? "↑"
            : priority === "LOW"
              ? "↓"
              : "−"}
      </span>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}
