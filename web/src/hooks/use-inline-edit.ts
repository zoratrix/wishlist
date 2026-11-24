import { useRef } from 'react';
import { useState } from 'react';
import { errorMessage } from '../lib/api';

export interface InlineEditOptions {
  /** Текущее сохранённое значение (в том виде, в каком оно редактируется). */
  value: string;
  /** Сохранить: может бросить ошибку — она покажется в ячейке, ввод не потеряется. */
  onSave: (next: string) => Promise<void>;
  /** Клиентская проверка: текст ошибки откатывает правку (rollback + сообщение). */
  validate?: (next: string) => string | null;
  /** Куда сообщить об откате (например, в общее сообщение страницы). */
  onInvalid?: (message: string) => void;
}

/**
 * Состояние правки «клик → поле»: Enter/blur сохраняет, Esc отменяет.
 * Во время сохранения поле остаётся открытым, ошибка не стирает введённое.
 */
export function useInlineEdit({ value, onSave, validate, onInvalid }: InlineEditOptions) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref'ы защищают от двойного сохранения (Enter + blur при размонтировании).
  const editingRef = useRef(false);
  const pendingRef = useRef(false);

  function start() {
    setDraft(value);
    setError(null);
    editingRef.current = true;
    setEditing(true);
  }

  function cancel() {
    editingRef.current = false;
    setEditing(false);
    setDraft(value);
    setError(null);
  }

  async function commit() {
    if (!editingRef.current || pendingRef.current) {
      return;
    }
    const next = draft;
    if (next === value) {
      cancel();
      return;
    }

    const invalid = validate ? validate(next) : null;
    if (invalid !== null) {
      // Откат к сохранённому значению + сообщение.
      cancel();
      onInvalid?.(invalid);
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onSave(next);
      editingRef.current = false;
      setEditing(false);
    } catch (saveError) {
      // Остаёмся в редактировании: введённое не теряется, можно повторить.
      setError(errorMessage(saveError));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return { editing, draft, setDraft, pending, error, start, cancel, commit };
}
