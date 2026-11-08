// Importing a module's *.jobs.ts registers its job handlers with the queue.
import "@/modules/billing/billing.jobs";
import "@/modules/knowledge/knowledge.jobs";
import "@/modules/messaging/messaging.jobs";
import "@/modules/notifications/notification.jobs";
import "@/modules/workflows/workflow.jobs";
