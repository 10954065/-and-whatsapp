"use client";

import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCY_OPTIONS, INDUSTRY_OPTIONS, TIMEZONE_OPTIONS } from "@/config/industries";
import { useActionForm } from "@/hooks/use-action-form";
import { createBusinessAction } from "@/modules/businesses/business.actions";

const COUNTRIES = [
  { code: "GH", name: "Ghana" },
  { code: "NG", name: "Nigeria" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "TG", name: "Togo" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

export function SelectField({
  label,
  name,
  defaultValue,
  options,
  errors,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  errors?: string[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`field-${name}`}>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={`field-${name}`} className="w-full" aria-invalid={Boolean(errors?.length) || undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errors?.length ? <p className="text-xs font-medium text-destructive">{errors.join(" ")}</p> : null}
    </div>
  );
}

export function CreateBusinessForm() {
  const { state, onSubmit, isPending } = useActionForm(createBusinessAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      <Field
        label="Business name"
        name="name"
        placeholder="e.g. Adwoa's Kitchen"
        required
        autoFocus
        errors={fieldErrors(state, "name")}
      />
      <SelectField
        label="Industry"
        name="industry"
        defaultValue="GENERAL"
        options={INDUSTRY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        errors={fieldErrors(state, "industry")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Country"
          name="country"
          defaultValue="GH"
          options={COUNTRIES.map((country) => ({ value: country.code, label: country.name }))}
          errors={fieldErrors(state, "country")}
        />
        <Field label="City" name="city" placeholder="Accra" errors={fieldErrors(state, "city")} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Timezone"
          name="timezone"
          defaultValue="Africa/Accra"
          options={TIMEZONE_OPTIONS.map((zone) => ({ value: zone, label: zone.replace("_", " ") }))}
          errors={fieldErrors(state, "timezone")}
        />
        <SelectField
          label="Currency"
          name="currency"
          defaultValue="GHS"
          options={CURRENCY_OPTIONS.map((code) => ({ value: code, label: code }))}
          errors={fieldErrors(state, "currency")}
        />
      </div>
      <SubmitButton size="lg" className="h-10 w-full" isPending={isPending} pendingLabel="Creating workspace…">
        Create workspace
      </SubmitButton>
    </form>
  );
}
