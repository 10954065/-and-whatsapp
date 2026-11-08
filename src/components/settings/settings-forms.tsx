"use client";

import { useState } from "react";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { SelectField } from "@/components/onboarding/create-business-form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CURRENCY_OPTIONS, INDUSTRY_OPTIONS, TIMEZONE_OPTIONS } from "@/config/industries";
import { useActionForm } from "@/hooks/use-action-form";
import {
  updateHoursAction,
  updateNotificationsAction,
  updateProfileAction,
} from "@/modules/businesses/settings.actions";

export interface ProfileValues {
  name: string;
  industry: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string;
  timezone: string;
  currency: string;
}

export function BusinessProfileForm({ values, disabled }: { values: ProfileValues; disabled: boolean }) {
  const { state, onSubmit, isPending } = useActionForm(updateProfileAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      <fieldset disabled={disabled} className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Business name" name="name" defaultValue={values.name} required errors={fieldErrors(state, "name")} />
          <SelectField
            label="Industry"
            name="industry"
            defaultValue={values.industry}
            options={INDUSTRY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            errors={fieldErrors(state, "industry")}
          />
        </div>
        <Field
          label="Description"
          name="description"
          multiline
          rows={4}
          maxLength={2000}
          defaultValue={values.description ?? ""}
          hint="What you sell or offer, who you serve and what makes you different. At least a couple of sentences."
          errors={fieldErrors(state, "description")}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Phone" name="phone" type="tel" defaultValue={values.phone ?? ""} errors={fieldErrors(state, "phone")} />
          <Field label="Email" name="email" type="email" defaultValue={values.email ?? ""} errors={fieldErrors(state, "email")} />
          <Field label="Website" name="website" type="url" placeholder="https://" defaultValue={values.website ?? ""} errors={fieldErrors(state, "website")} />
        </div>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Address" name="address" defaultValue={values.address ?? ""} errors={fieldErrors(state, "address")} />
          <Field label="City" name="city" defaultValue={values.city ?? ""} errors={fieldErrors(state, "city")} />
          <Field label="Country code" name="country" maxLength={2} defaultValue={values.country} errors={fieldErrors(state, "country")} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Timezone"
            name="timezone"
            defaultValue={values.timezone}
            options={TIMEZONE_OPTIONS.map((zone) => ({ value: zone, label: zone.replace("_", " ") }))}
          />
          <SelectField
            label="Currency"
            name="currency"
            defaultValue={values.currency}
            options={CURRENCY_OPTIONS.map((code) => ({ value: code, label: code }))}
          />
        </div>
      </fieldset>
      {disabled ? null : (
        <div>
          <SubmitButton isPending={isPending} pendingLabel="Saving…">
            Save profile
          </SubmitButton>
        </div>
      )}
    </form>
  );
}

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type Hours = Record<string, { start: string; end: string }[]>;

const DEFAULT_HOURS: Hours = {
  mon: [{ start: "08:00", end: "17:00" }],
  tue: [{ start: "08:00", end: "17:00" }],
  wed: [{ start: "08:00", end: "17:00" }],
  thu: [{ start: "08:00", end: "17:00" }],
  fri: [{ start: "08:00", end: "17:00" }],
  sat: [{ start: "09:00", end: "14:00" }],
  sun: [],
};

function DayRow({ day, initial, disabled }: { day: string; initial: { start: string; end: string } | undefined; disabled: boolean }) {
  const [isOpen, setIsOpen] = useState(Boolean(initial));
  return (
    <div className="grid grid-cols-[7rem_auto_1fr] items-center gap-4 border-b py-3 last:border-b-0">
      <Label htmlFor={`${day}_open`} className="font-medium">
        {DAY_LABELS[day]}
      </Label>
      <Switch id={`${day}_open`} name={`${day}_open`} checked={isOpen} onCheckedChange={setIsOpen} disabled={disabled} value="on" />
      {isOpen ? (
        <div className="flex items-center gap-2 text-sm">
          <input type="time" name={`${day}_start`} defaultValue={initial?.start ?? "08:00"} aria-label={`${DAY_LABELS[day]} opening time`} disabled={disabled} className="h-8 rounded-md border bg-background px-2" />
          <span className="text-muted-foreground">to</span>
          <input type="time" name={`${day}_end`} defaultValue={initial?.end ?? "17:00"} aria-label={`${DAY_LABELS[day]} closing time`} disabled={disabled} className="h-8 rounded-md border bg-background px-2" />
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Closed</span>
      )}
    </div>
  );
}

export function BusinessHoursForm({ hours, disabled }: { hours: Hours | null; disabled: boolean }) {
  const { state, onSubmit, isPending } = useActionForm(updateHoursAction);
  const initial = hours ?? DEFAULT_HOURS;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      {!hours ? <p className="text-sm text-muted-foreground">Suggested hours are pre-filled — adjust and save.</p> : null}
      <div className="rounded-xl border px-4">
        {Object.keys(DAY_LABELS).map((day) => (
          <DayRow key={day} day={day} initial={initial[day]?.[0]} disabled={disabled} />
        ))}
      </div>
      {disabled ? null : (
        <div>
          <SubmitButton isPending={isPending} pendingLabel="Saving…">
            Save opening hours
          </SubmitButton>
        </div>
      )}
    </form>
  );
}

export interface NotificationValues {
  notificationEmail: string | null;
  notifyOnEscalation: boolean;
  notifyOnNewOrder: boolean;
  notifyOnNewBooking: boolean;
  notifyOnLowStock: boolean;
  messageRetentionDays: number;
}

const TOGGLES: { name: keyof NotificationValues; label: string }[] = [
  { name: "notifyOnEscalation", label: "A conversation is escalated to a person" },
  { name: "notifyOnNewOrder", label: "A new order is created" },
  { name: "notifyOnNewBooking", label: "A new booking is made" },
  { name: "notifyOnLowStock", label: "A product runs low on stock" },
];

export function NotificationSettingsForm({ values, disabled }: { values: NotificationValues; disabled: boolean }) {
  const { state, onSubmit, isPending } = useActionForm(updateNotificationsAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      <fieldset disabled={disabled} className="grid gap-5">
        <Field
          label="Notification email"
          name="notificationEmail"
          type="email"
          defaultValue={values.notificationEmail ?? ""}
          hint="Alerts are emailed here. Leave empty to email workspace owners and admins."
          errors={fieldErrors(state, "notificationEmail")}
        />
        <div className="grid gap-3">
          <p className="text-sm font-medium">Notify the team (in the app and by email) when…</p>
          {TOGGLES.map((toggle) => (
            <label key={toggle.name} className="flex items-center gap-3 text-sm">
              <Switch name={toggle.name} value="on" defaultChecked={Boolean(values[toggle.name])} />
              {toggle.label}
            </label>
          ))}
        </div>
        <Field
          label="Delete conversation content after (days)"
          name="messageRetentionDays"
          type="number"
          min={0}
          max={3650}
          defaultValue={values.messageRetentionDays}
          hint="0 keeps messages until you delete them. Orders, payments and audit records are kept regardless."
          errors={fieldErrors(state, "messageRetentionDays")}
        />
      </fieldset>
      {disabled ? null : (
        <div>
          <SubmitButton isPending={isPending} pendingLabel="Saving…">
            Save notification settings
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
