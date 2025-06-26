import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";

import { travelPlannerAgent } from "./agents/travel-planner-agent/travel-planner-agent";
import { smartTravelPlannerWorkflow } from "./agents/travel-planner-agent/travel-planner-workflow";

export const mastra = new Mastra({
  workflows: {
    smartTravelPlannerWorkflow,
  },
  agents: {
    travelPlannerAgent,
  },
  logger: new PinoLogger({
    name: "SmartTravelPlanner",
    level: "info",
  }),
  server: {
    port: 8080,
    timeout: 30000, // Increased timeout for complex travel planning
  },
});

console.log("🚀 Smart Travel Planner for Nosana Challenge");
console.log("📋 Available Agents:");
console.log(
  "  - travelPlannerAgent: Advanced travel planning with multi-agent workflow"
);
console.log("📋 Available Workflows:");
console.log(
  "  - smartTravelPlannerWorkflow: Complete travel itinerary generation"
);

console.log("🌐 Server starting on port 8080...");
