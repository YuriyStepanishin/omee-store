'use client';

import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import css from './Admin.module.css';

const mobileQuery = '(max-width: 767px)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const isMobile = () => window.matchMedia(mobileQuery).matches;
const isServerMobile = () => false;

type Props = {
  title: string;
  editing: boolean;
  busy: boolean;
  onDismiss: () => void;
  message?: string;
  failed?: boolean;
  children: ReactNode;
};

export default function EditPanel({ title, editing, busy, onDismiss, message, failed, children }: Props) {
  const modal = useSyncExternalStore(subscribe, isMobile, isServerMobile) && editing;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!modal || !dialog) return;

    dialog.showModal();
    return () => dialog.close();
  }, [modal]);

  if (!modal) {
    return <section className={css.panel}><h2>{title}</h2>{children}</section>;
  }

  return (
    <dialog
      ref={dialogRef}
      className={css.editDialog}
      aria-labelledby={titleId}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onDismiss();
      }}
    >
      <header className={css.editDialogHeader}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className={css.button} disabled={busy} onClick={onDismiss} autoFocus>
          Закрити
        </button>
        {message && (
          <p className={failed ? css.error : css.status} role={failed ? 'alert' : 'status'}>
            {message}
          </p>
        )}
      </header>
      <div className={css.editDialogBody}>{children}</div>
    </dialog>
  );
}
