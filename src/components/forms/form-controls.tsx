"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/monitoring/errors";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  isPending,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string; isPending?: boolean }) {
  const status = useFormStatus();
  const pending = isPending ?? status.pending;
  return (
    <Button type="submit" disabled={pending || disabled} className={className} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}

type FieldProps = ComponentProps<typeof Input> & {
  label: string;
  name: string;
  hint?: ReactNode;
  errors?: string[];
  multiline?: boolean;
  rows?: number;
};

/** Label + input + hint + error messages, wired up for screen readers. */
export function Field({ label, name, hint, errors, multiline, rows = 4, className, id, ...props }: FieldProps) {
  const fieldId = id ?? `field-${name}`;
  const hasErrors = Boolean(errors?.length);
  const describedBy = [hint ? `${fieldId}-hint` : null, hasErrors ? `${fieldId}-error` : null]
    .filter(Boolean)
    .join(" ");
  const shared = {
    id: fieldId,
    name,
    "aria-invalid": hasErrors || undefined,
    "aria-describedby": describedBy || undefined,
  };
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      {multiline ? (
        <Textarea
          {...shared}
          rows={rows}
          defaultValue={props.defaultValue as string | undefined}
          placeholder={props.placeholder}
          required={props.required}
          maxLength={props.maxLength}
        />
      ) : (
        <Input {...shared} {...props} />
      )}
      {hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {hasErrors ? (
        <p id={`${fieldId}-error`} className="text-xs font-medium text-destructive">
          {errors?.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

/** Shows the form-level error or success message of an ActionResult. */
export function FormAlert({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (state.ok && !state.message) return null;
  const isSuccess = state.ok;
  const text = state.ok ? state.message : state.error;
  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        isSuccess ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10",
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      )}
      <span>{text}</span>
    </div>
  );
}

export function fieldErrors(state: ActionResult<unknown> | null, name: string): string[] | undefined {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}
