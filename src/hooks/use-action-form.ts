"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionResult } from "@/lib/monitoring/errors";

type FormServerAction<T> = (previous: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

/**
 * Binds a Server Action to a form without React's automatic form reset, so typed values
 * survive validation errors. Returns the latest result and a pending flag.
 */
export function useActionForm<T>(action: FormServerAction<T>) {
  const [state, dispatch, isPending] = useActionState(action, null);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { state, onSubmit, isPending };
}
