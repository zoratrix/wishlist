import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, ApiError, errorMessage } from '../lib/api';
import { parsePriceMinor } from '../lib/format';
import { normalizeLinks, validateLinks } from '../lib/links';
import type { GiftResponse } from '../lib/types';

export interface GiftAddFields {
  title: string;
  priority: string;
  price: string;
  links: string[];
  description: string;
  categoryId: string;
}

const EMPTY_FIELDS: GiftAddFields = {
  title: '',
  priority: '3',
  price: '',
  links: [''],
  description: '',
  categoryId: '',
};

/**
 * Добавление подарка одной строкой: все поля (включая несколько ссылок) уходят
 * одним POST, после успеха строка очищается, фокус возвращается в «Название».
 */
export function useGiftAdd(listId: string) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<GiftAddFields>(EMPTY_FIELDS);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const mutation = useMutation<GiftResponse, ApiError, Record<string, unknown>>({
    mutationFn: (payload) => apiPost<GiftResponse>(`/me/wishlists/${listId}/gifts`, payload),
    onSuccess: () => {
      setFields(EMPTY_FIELDS);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['wishlist', listId] });
      void queryClient.invalidateQueries({ queryKey: ['wishlists'] });
      titleRef.current?.focus();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  function setField(
    name: 'title' | 'priority' | 'price' | 'description' | 'categoryId',
    value: string,
  ) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function setLink(index: number, value: string) {
    setFields((current) => ({
      ...current,
      links: current.links.map((link, currentIndex) => (currentIndex === index ? value : link)),
    }));
  }

  function setLinks(links: string[]) {
    setFields((current) => ({ ...current, links: links.length === 0 ? [''] : links }));
  }

  function addLink() {
    setFields((current) =>
      current.links.length >= 10 ? current : { ...current, links: [...current.links, ''] },
    );
  }

  function removeLink(index: number) {
    setFields((current) => {
      const next = current.links.filter((_link, currentIndex) => currentIndex !== index);
      return { ...current, links: next.length === 0 ? [''] : next };
    });
  }

  function submit() {
    if (mutation.isPending) {
      return;
    }

    const title = fields.title.trim();
    if (title === '') {
      setError('Введите название подарка.');
      titleRef.current?.focus();
      return;
    }

    let priceMinor: number | null;
    try {
      priceMinor = parsePriceMinor(fields.price);
    } catch (priceError) {
      setError(errorMessage(priceError));
      return;
    }

    const links = normalizeLinks(fields.links);
    const linksError = validateLinks(fields.links);
    if (linksError !== null) {
      setError(linksError);
      return;
    }

    const description = fields.description.trim();
    if (description.length > 2000) {
      setError('Описание должно быть не длиннее 2000 символов.');
      return;
    }

    setError(null);
    const payload: Record<string, unknown> = { title, priority: Number(fields.priority) };
    if (description !== '') {
      payload.description = description;
    }
    if (links.length > 0) {
      payload.links = links;
    }
    if (fields.categoryId !== '') {
      payload.categoryIds = [fields.categoryId];
    }
    if (priceMinor !== null) {
      payload.priceMinor = priceMinor;
    }
    mutation.mutate(payload);
  }

  /** Enter в любом однострочном поле = «Добавить и продолжить». */
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }

  return {
    fields,
    setField,
    setLink,
    setLinks,
    addLink,
    removeLink,
    submit,
    handleKeyDown,
    error,
    setError,
    isPending: mutation.isPending,
    titleRef,
  };
}
