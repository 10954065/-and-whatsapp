import { registerJobHandler } from "@/lib/queue";
import { processWorkflowEvent, workflowEventSchema } from "@/modules/workflows/workflow.engine";

registerJobHandler("automation.event", async (payload) => {
  await processWorkflowEvent(workflowEventSchema.parse(payload));
});
