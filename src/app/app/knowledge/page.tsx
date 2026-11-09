import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { AddKnowledgeTabs, SourceActions } from "@/components/knowledge/knowledge-forms";
import { AccessDenied, EmptyState, PageHeader } from "@/components/app/page-primitives";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { getPlanLimits } from "@/modules/billing/usage";
import { isEmbeddingConfigured } from "@/modules/knowledge/embeddings";
import { getKnowledgeStorageBytes, listKnowledgeSources } from "@/modules/knowledge/knowledge.service";

export const metadata: Metadata = { title: "Knowledge base" };

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  READY: { label: "Ready", variant: "default" },
  PENDING: { label: "Queued", variant: "secondary" },
  PROCESSING: { label: "Processing", variant: "secondary" },
  FAILED: { label: "Failed", variant: "destructive" },
};

const TYPE_LABEL: Record<string, string> = { FAQ: "FAQ", TEXT: "Text", DOCUMENT: "Document", WEBSITE: "Website" };

export default async function KnowledgePage() {
  const context = await requireTenant();
  if (!context.can("knowledge.read")) return <AccessDenied what="the knowledge base" />;
  const [sources, usedBytes, limits] = await Promise.all([
    listKnowledgeSources(context.businessId),
    getKnowledgeStorageBytes(context.businessId),
    getPlanLimits(context.businessId),
  ]);
  const canManage = context.can("knowledge.manage");
  const limitBytes = limits.knowledgeStorageMb * 1024 * 1024;
  const percent = limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Everything your assistant is allowed to say comes from here and your business profile. It never shares this with other businesses."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="overflow-hidden surface rounded-[1.25rem]">
          {sources.length === 0 ? (
            <EmptyState
              className="m-6"
              icon={BookOpen}
              title="Teach your assistant"
              description="Start with your ten most common customer questions, your delivery and returns policies, and a price list."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                  <TableHead className="sr-only">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="max-w-xs">
                      <p className="truncate font-medium">{source.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABEL[source.type]} · v{source.version}
                        {source.chunkCount ? ` · ${source.chunkCount} passage${source.chunkCount === 1 ? "" : "s"}` : ""}
                      </p>
                      {source.error ? <p className="mt-1 text-xs text-destructive">{source.error}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS[source.status].variant}>{STATUS[source.status].label}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatRelative(source.updatedAt)}</TableCell>
                    <TableCell>{canManage ? <SourceActions id={source.id} canReprocess={source.status === "FAILED"} /> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        <aside className="grid content-start gap-6">
          {canManage ? (
            <section className="surface rounded-[1.25rem] p-6">
              <h2 className="mb-4 text-base font-semibold">Add knowledge</h2>
              <AddKnowledgeTabs />
            </section>
          ) : null}
          <section className="surface rounded-[1.25rem] p-6 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Storage</span>
              <span className="text-muted-foreground">
                {(usedBytes / 1024 / 1024).toFixed(1)} of {limits.knowledgeStorageMb} MB
              </span>
            </div>
            <Progress value={percent} className="mt-3" aria-label="Knowledge storage used" />
            <p className="mt-4 text-muted-foreground">
              Search: {isEmbeddingConfigured() ? "semantic + keyword (Voyage embeddings)" : "keyword search (semantic search turns on when embeddings are configured)"}.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
