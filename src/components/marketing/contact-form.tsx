"use client";

import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { useActionForm } from "@/hooks/use-action-form";
import { contactAction } from "@/modules/support/contact.actions";

export function ContactForm() {
  const { state, onSubmit, isPending } = useActionForm(contactAction);
  if (state?.ok) return <FormAlert state={state} />;
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" autoComplete="name" required errors={fieldErrors(state, "name")} />
        <Field label="Email" name="email" type="email" autoComplete="email" required errors={fieldErrors(state, "email")} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business (optional)" name="company" autoComplete="organization" errors={fieldErrors(state, "company")} />
        <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" errors={fieldErrors(state, "phone")} />
      </div>
      <Field label="How can we help?" name="message" multiline rows={6} required errors={fieldErrors(state, "message")} />
      {/* Honeypot field for bots — hidden from people and assistive technology. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <SubmitButton size="lg" isPending={isPending} pendingLabel="Sending…">
          Send message
        </SubmitButton>
      </div>
    </form>
  );
}
