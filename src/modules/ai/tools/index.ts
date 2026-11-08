import { checkAvailabilityTool, createBookingTool } from "@/modules/bookings/bookings.tools";
import { checkStockTool, createOrderTool, orderStatusTool, productInfoTool } from "@/modules/commerce/commerce.tools";
import { registerTools } from "@/modules/ai/tools/registry";

// Business-operation tools live with their modules and are registered here once.
registerTools([productInfoTool, checkStockTool, createOrderTool, orderStatusTool, checkAvailabilityTool, createBookingTool]);

export { executeTool, listTools, permittedToolNames, toolDefinitions } from "@/modules/ai/tools/registry";
