"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/monitoring/errors";
import {
  createFaqAction,
  createTextAction,
  deleteSourceAction,
  importWebsiteAction,
  reprocessSourceAction,
  uploadDocumentAction,
} from "@/modules/knowledge/knowledge.actions";

/** Clears the form after a successful submission. */
function useResetOnSuccess(state: ActionResult<unknown> | null) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

function FaqForm() {
  const { state, onSubmit, isPending } = useActionForm(createFaqAction);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field label="Question" name="question" placeholder="Do you deliver on Sundays?" errors={fieldErrors(state, "question")} />
      <Field label="Answer" name="answer" multiline rows={4} placeholder="Yes, within Accra from 10am to 4pm. Delivery is GH₵20." errors={fieldErrors(state, "answer")} />
      <div>
        <SubmitButton isPending={isPending} pendingLabel="Adding…">
          Add FAQ
        </SubmitButton>
      </div>
    </form>
  );
}

function TextForm() {
  const { state, onSubmit, isPending } = useActionForm(createTextAction);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field label="Title" name="title" placeholder="Returns policy" errors={fieldErrors(state, "title")} />
      <Field label="Content" name="content" multiline rows={8} errors={fieldErrors(state, "content")} />
      <div>
        <SubmitButton isPending={isPending} pendingLabel="Adding…">
          Add text
        </SubmitButton>
      </div>
    </form>
  );
}

function UploadForm() {
  const { state, onSubmit, isPending } = useActionForm(uploadDocumentAction);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4" encType="multipart/form-data" noValidate>
      <FormAlert state={state} />
      <div className="grid gap-1.5">
        <Label htmlFor="knowledge-file">Document</Label>
        <Input id="knowledge-file" name="file" type="file" accept=".pdf,.docx,.txt,.md,.csv" />
        <p className="text-xs text-muted-foreground">PDF, Word (.docx), TXT, Markdown or CSV, up to 10 MB. Price lists work well as CSV.</p>
      </div>
      <div>
        <SubmitButton isPending={isPending} pendingLabel="Uploading…">
          Upload
        </SubmitButton>
      </div>
    </form>
  );
}

function WebsiteForm() {
  const { state, onSubmit, isPending } = useActionForm(importWebsiteAction);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Page address"
        name="url"
        type="url"
        placeholder="https://yourbusiness.com/faq"
        hint="Import a public page from your own website. Only https pages are accepted."
        errors={fieldErrors(state, "url")}
      />
      <div>
        <SubmitButton isPending={isPending} pendingLabel="Queuing…">
          Import page
        </SubmitButton>
      </div>
    </form>
  );
}

export function AddKnowledgeTabs() {
  return (
    <Tabs defaultValue="faq">
      <TabsList className="mb-4 flex-wrap">
        <TabsTrigger value="faq">FAQ</TabsTrigger>
        <TabsTrigger value="text">Text</TabsTrigger>
        <TabsTrigger value="upload">Document</TabsTrigger>
        <TabsTrigger value="website">Website</TabsTrigger>
      </TabsList>
      <TabsContent value="faq">
        <FaqForm />
      </TabsContent>
      <TabsContent value="text">
        <TextForm />
      </TabsContent>
      <TabsContent value="upload">
        <UploadForm />
      </TabsContent>
      <TabsContent value="website">
        <WebsiteForm />
      </TabsContent>
    </Tabs>
  );
}

export function SourceActions({ id, canReprocess }: { id: string; canReprocess: boolean }) {
  const remove = useActionForm(deleteSourceAction);
  const reprocess = useActionForm(reprocessSourceAction);
  useEffect(() => {
    for (const state of [remove.state, reprocess.state]) {
      if (state?.ok && state.message) toast.success(state.message);
      if (state && !state.ok) toast.error(state.error);
    }
  }, [remove.state, reprocess.state]);
  return (
    <div className="flex justify-end gap-1">
      {canReprocess ? (
        <form onSubmit={reprocess.onSubmit}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton size="sm" variant="ghost" isPending={reprocess.isPending}>
            Retry
          </SubmitButton>
        </form>
      ) : null}
      <form onSubmit={remove.onSubmit}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton size="sm" variant="ghost" className="text-destructive" isPending={remove.isPending}>
          Remove
        </SubmitButton>
      </form>
    </div>
  );
}
