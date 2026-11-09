"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { Label } from "@/components/ui/label";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/monitoring/errors";
import { cn } from "@/lib/utils";

type FormAction = (previous: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown>>;

export interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "password" | "textarea" | "select" | "checkbox" | "date" | "time" | "datetime-local" | "checkboxes";
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
  step?: string;
}

const selectClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

function SpecField({ spec, errors }: { spec: FieldSpec; errors?: string[] }) {
  const id = `quick-${spec.name}`;
  if (spec.type === "select") {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{spec.label}</Label>
        <select id={id} name={spec.name} defaultValue={spec.defaultValue} className={selectClass} aria-invalid={Boolean(errors?.length) || undefined}>
          {spec.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors?.length ? <p className="text-xs text-destructive">{errors.join(" ")}</p> : null}
      </div>
    );
  }
  if (spec.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={spec.name} defaultChecked={spec.defaultValue === "on"} className="size-4" /> {spec.label}
      </label>
    );
  }
  if (spec.type === "checkboxes") {
    return (
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-medium">{spec.label}</legend>
        <div className="flex flex-wrap gap-3">
          {spec.options?.map((option) => (
            <label key={option.value} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name={spec.name} value={option.value} className="size-4" /> {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <Field
      label={spec.label}
      name={spec.name}
      type={spec.type === "textarea" ? undefined : (spec.type ?? "text")}
      multiline={spec.type === "textarea"}
      placeholder={spec.placeholder}
      defaultValue={spec.defaultValue}
      hint={spec.hint}
      step={spec.step}
      id={id}
      errors={errors}
    />
  );
}

/** A configurable form bound to a Server Action (configuration keeps it usable from Server Components). */
export function QuickForm({
  action,
  fields,
  submitLabel,
  hidden = {},
  columns = 1,
  resetOnSuccess = true,
}: {
  action: FormAction;
  fields: FieldSpec[];
  submitLabel: string;
  hidden?: Record<string, string>;
  columns?: 1 | 2 | 3;
  resetOnSuccess?: boolean;
}) {
  const { state, onSubmit, isPending } = useActionForm(action);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
        {fields.map((spec) => (
          <SpecField key={spec.name} spec={spec} errors={fieldErrors(state, spec.name)} />
        ))}
      </div>
      <div>
        <SubmitButton isPending={isPending} pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

/** A single-button form (e.g. cancel, mark done) with toast feedback. */
export function ActionButton({
  action,
  values,
  label,
  variant = "outline",
}: {
  action: FormAction;
  values: Record<string, string>;
  label: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
}) {
  const { state, onSubmit, isPending } = useActionForm(action);
  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state && !state.ok) toast.error(state.error);
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="inline">
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton size="sm" variant={variant} isPending={isPending}>
        {label}
      </SubmitButton>
    </form>
  );
}

/** Compact select + submit (e.g. order or lead status, payment method). */
export function StatusSelect({
  action,
  values,
  name,
  current,
  options,
  labels = {},
  ariaLabel = "Status",
  submitLabel = "Save",
}: {
  action: FormAction;
  values: Record<string, string>;
  name: string;
  current: string;
  options: string[];
  labels?: Record<string, string>;
  ariaLabel?: string;
  submitLabel?: string;
}) {
  const { state, onSubmit, isPending } = useActionForm(action);
  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
    if (state?.ok && state.message) toast.success(state.message);
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-1.5">
      {Object.entries(values).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <select name={name} defaultValue={current} className="h-7 rounded-md border bg-background px-1.5 text-xs" aria-label={ariaLabel}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] ?? option.toLowerCase()}
          </option>
        ))}
      </select>
      <SubmitButton size="xs" variant="ghost" isPending={isPending}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
