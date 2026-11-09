"use client";

import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { Badge } from "@/components/ui/badge";
import { useActionForm } from "@/hooks/use-action-form";
import { applyTemplateAction } from "@/modules/onboarding/template.actions";

export interface IndustryTemplateFormProps {
  industryLabel: string;
  roleDescription: string;
  fields: { key: string; label: string; placeholder: string; value: string }[];
  workflows: { id: string; name: string; description: string; added: boolean }[];
  tools: { name: string; label: string }[];
  commonQuestions: string[];
  tips: string[];
  otherAnswers: number;
  /** Server-formatted date the template was applied, or null. */
  appliedLabel: string | null;
  agentConfigured: boolean;
  canManageAutomation: boolean;
  disabled: boolean;
}

export function IndustryTemplateForm(props: IndustryTemplateFormProps) {
  const { state, onSubmit, isPending } = useActionForm(applyTemplateAction);
  const pendingWorkflows = props.workflows.filter((workflow) => !workflow.added);

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <FormAlert state={state} />
      <div className="rounded-xl bg-muted/50 p-4 text-sm">
        <p>
          <span className="font-semibold">{props.industryLabel}</span>: {props.roleDescription}
        </p>
        <p className="mt-1 text-muted-foreground">
          {props.appliedLabel ? `Applied ${props.appliedLabel}. Saving again updates your answers.` : "Not applied yet."} Change your industry in the business profile above.
        </p>
      </div>

      <fieldset disabled={props.disabled} className="grid gap-6">
        <div className="grid gap-4">
          <p className="text-sm font-semibold">Tell your AI employee the basics</p>
          {props.fields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              name={`answer_${field.key}`}
              multiline
              rows={2}
              maxLength={1000}
              defaultValue={field.value}
              placeholder={field.placeholder}
              errors={fieldErrors(state, `answer_${field.key}`)}
            />
          ))}
          <p className="text-xs text-muted-foreground">
            These answers are trusted facts in every AI conversation, alongside your knowledge base.
            {props.otherAnswers > 0 ? ` ${props.otherAnswers} saved answer(s) from your previous industry will be removed when you save.` : ""}
          </p>
        </div>

        <div className="grid gap-3">
          <p className="text-sm font-semibold">Starter workflows</p>
          {props.workflows.map((workflow) => (
            <label key={workflow.id} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="workflows"
                value={workflow.id}
                defaultChecked={!workflow.added}
                disabled={workflow.added || !props.canManageAutomation}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="font-medium">{workflow.name}</span>
                {workflow.added ? <Badge variant="secondary" className="ml-2">added</Badge> : null}
                <span className="block text-muted-foreground">{workflow.description}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            {props.canManageAutomation
              ? pendingWorkflows.length > 0
                ? "Workflows are created as drafts. Review and activate them in Automation."
                : "All starter workflows for this industry have been added."
              : "Ask an owner or admin to add workflows."}
          </p>
        </div>

        <div className="grid gap-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="applyAgentDefaults" value="on" defaultChecked={!props.agentConfigured} className="mt-0.5 size-4" />
            <span>
              <span className="font-medium">Set my AI employee&apos;s tone, role and tools to this template</span>
              <span className="block text-muted-foreground">
                {props.agentConfigured ? "You've already configured your AI employee; this replaces its tone, role and permitted tools." : "Recommended for a new workspace."}
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {props.tools.map((tool) => (
              <Badge key={tool.name} variant="outline">
                {tool.label}
              </Badge>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold">Customers often ask</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {props.commonQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Add answers to these as FAQs in the knowledge base.</p>
        </div>
        <div>
          <p className="font-semibold">Tips</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {props.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>

      {props.disabled ? null : (
        <div>
          <SubmitButton isPending={isPending} pendingLabel="Applying…">
            {props.appliedLabel ? "Save template" : "Apply template"}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
