// Smart Travel Planner Workflow - Advanced Multi-Step Travel Planning
import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { model } from "../../config";
import {
  weatherForecastTool,
  destinationResearchTool,
  budgetCalculatorTool,
  attractionsFinderTool,
} from "./travel-planner-tools";

// =============== SPECIALIZED AGENTS ===============

const itineraryPlannerAgent = new Agent({
  name: "Itinerary Planner",
  model,
  instructions: `
    You are a master itinerary planner who creates seamless, day-by-day travel schedules.
    
    Your expertise:
    - Optimal activity sequencing and timing
    - Geographic proximity planning to minimize travel time
    - Weather-based activity optimization
    - Energy level management throughout the day
    - Cultural event and local festival integration
    - Realistic time estimates including travel between locations
    
    Create detailed daily schedules that flow naturally and maximize the travel experience.
    Always consider:
    - Morning energy levels (active outdoor activities)
    - Afternoon heat/weather patterns
    - Evening dining and entertainment timing
    - Rest periods and travel time between activities
    - Budget allocation across the day
    
    Format responses with specific times, locations, costs, and practical notes.
  `,
});

// =============== SCHEMAS ===============

const tripRequestSchema = z.object({
  destination: z.string().describe("Travel destination"),
  startDate: z.string().describe("Start date (YYYY-MM-DD)"),
  endDate: z.string().describe("End date (YYYY-MM-DD)"),
  budget: z.number().describe("Total budget in USD"),
  travelers: z.number().describe("Number of travelers"),
  interests: z.array(z.string()).describe("Travel interests"),
  travelStyle: z
    .enum(["budget", "mid-range", "luxury"])
    .describe("Travel style"),
});

const researchDataSchema = z.object({
  destination: z.string(),
  weatherForecast: z.object({
    destination: z.string(),
    country: z.string(),
    forecast: z.array(
      z.object({
        date: z.string(),
        condition: z.string(),
        maxTemp: z.number(),
        minTemp: z.number(),
        precipitationChance: z.number(),
      })
    ),
    summary: z.string(),
  }),
  destinationInfo: z.object({
    destination: z.string(),
    country: z.string(),
    currency: z.string(),
    culturalTips: z.array(z.string()),
    safetyLevel: z.enum(["low", "medium", "high"]),
    estimatedDailyCosts: z.object({
      accommodation: z.number(),
      food: z.number(),
      transport: z.number(),
      activities: z.number(),
      total: z.number(),
    }),
    keyAttractions: z.array(z.string()),
  }),
  budgetPlan: z.object({
    totalBudget: z.number(),
    dailyBudget: z.number(),
    breakdown: z.any(),
    recommendations: z.array(z.string()),
  }),
  attractions: z.object({
    destination: z.string(),
    attractions: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
        estimatedCost: z.number(),
        timeNeeded: z.string(),
        rating: z.number(),
        category: z.string(),
      })
    ),
    categories: z.array(z.string()),
  }),
});

const completeItinerarySchema = z.object({
  itinerary: z.string(),
  summary: z.object({
    destination: z.string(),
    duration: z.number(),
    totalBudget: z.number(),
    travelers: z.number(),
    highlights: z.array(z.string()),
  }),
});

// =============== WORKFLOW STEPS ===============

const gatherTravelData = createStep({
  id: "gather-travel-data",
  description: "Collect comprehensive travel data from multiple sources",
  inputSchema: tripRequestSchema,
  outputSchema: researchDataSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Travel request data not found");
    }

    console.log(
      `🔍 Researching ${inputData.destination} for ${inputData.travelers} travelers...`
    );

    const duration = Math.ceil(
      (new Date(inputData.endDate).getTime() -
        new Date(inputData.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    console.log(
      `📅 Trip duration: ${duration} days (${inputData.startDate} to ${inputData.endDate})`
    );

    // Execute all research tools in parallel for efficiency
    console.log(`🚀 Starting parallel data collection...`);

    const [weatherData, destinationData, budgetData, attractionsData] =
      await Promise.all([
        weatherForecastTool.execute({
          inputData: {
            destination: inputData.destination,
            startDate: inputData.startDate,
            endDate: inputData.endDate,
          },
        }),
        destinationResearchTool.execute({
          inputData: {
            destination: inputData.destination,
            travelStyle: inputData.travelStyle,
            travelers: inputData.travelers,
          },
        }),
        budgetCalculatorTool.execute({
          inputData: {
            totalBudget: inputData.budget,
            duration: duration,
            travelers: inputData.travelers,
            travelStyle: inputData.travelStyle,
            destination: inputData.destination,
          },
        }),
        attractionsFinderTool.execute({
          inputData: {
            destination: inputData.destination,
            interests: inputData.interests,
            duration: duration,
            budget: Math.round((inputData.budget / duration) * 0.2), // 20% of daily budget for activities
          },
        }),
      ]);

    console.log(
      `✅ Research complete: Weather ✓ Destination ✓ Budget ✓ Attractions ✓`
    );

    return {
      destination: inputData.destination,
      weatherForecast: weatherData,
      destinationInfo: destinationData,
      budgetPlan: budgetData,
      attractions: attractionsData,
    };
  },
});

const createDetailedItinerary = createStep({
  id: "create-detailed-itinerary",
  description: "Create comprehensive day-by-day travel itinerary",
  inputSchema: z.object({
    tripRequest: tripRequestSchema,
    researchData: researchDataSchema,
  }),
  outputSchema: completeItinerarySchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Trip request and research data required");
    }

    const { tripRequest, researchData } = inputData;

    console.log(
      `📅 Creating detailed itinerary for ${researchData.destination}...`
    );

    const duration = Math.ceil(
      (new Date(tripRequest.endDate).getTime() -
        new Date(tripRequest.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Prepare comprehensive data for the itinerary planner
    const planningPrompt = `Create a detailed ${duration}-day itinerary for ${
      researchData.destination
    }.

TRIP DETAILS:
${JSON.stringify(tripRequest, null, 2)}

WEATHER FORECAST:
${JSON.stringify(researchData.weatherForecast, null, 2)}

DESTINATION INFO:
${JSON.stringify(researchData.destinationInfo, null, 2)}

BUDGET PLAN:
${JSON.stringify(researchData.budgetPlan, null, 2)}

AVAILABLE ATTRACTIONS:
${JSON.stringify(researchData.attractions, null, 2)}

Requirements:
- Create a day-by-day schedule with specific times
- Match activities to weather conditions each day
- Stay within the calculated budget
- Include morning, afternoon, and evening activities
- Add meal recommendations with estimated costs
- Provide backup indoor plans for bad weather days
- Include cultural tips and practical advice
- Balance energy levels throughout each day
- Minimize travel time between locations

Format the response as a comprehensive travel guide with all the formatting specified in your instructions.
`;

    // Generate the complete itinerary using the specialized agent
    const response = await itineraryPlannerAgent.stream([
      {
        role: "user",
        content: planningPrompt,
      },
    ]);

    let itineraryText = "";
    console.log(`🎯 Generating itinerary...`);

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      itineraryText += chunk;
    }

    console.log(`\n✅ Complete itinerary generated!`);

    // Create summary
    const highlights = [
      ...researchData.attractions.attractions.slice(0, 3).map((a) => a.name),
      `${
        researchData.weatherForecast.forecast.filter(
          (d) => d.precipitationChance < 30
        ).length
      } sunny days`,
      `${researchData.destinationInfo.culturalTips.length} cultural insights included`,
    ];

    return {
      itinerary: itineraryText,
      summary: {
        destination: researchData.destination,
        duration,
        totalBudget: tripRequest.budget,
        travelers: tripRequest.travelers,
        highlights,
      },
    };
  },
});

// =============== MAIN WORKFLOW ===============

const smartTravelPlannerWorkflow = createWorkflow({
  id: "smart-travel-planner-workflow",
  inputSchema: tripRequestSchema,
  outputSchema: completeItinerarySchema,
})
  .then(gatherTravelData)
  .then(async ({ inputData, stepOutputs }) => {
    // Pass both original request and research data to final step
    return {
      tripRequest: inputData,
      researchData: stepOutputs["gather-travel-data"],
    };
  })
  .then(createDetailedItinerary);

smartTravelPlannerWorkflow.commit();

// =============== CONVENIENCE FUNCTION ===============

export async function planSmartTrip(
  tripRequest: z.infer<typeof tripRequestSchema>
) {
  try {
    console.log(
      `🧳 Smart Travel Planner started for ${tripRequest.destination}`
    );
    console.log(
      `📊 Budget: $${tripRequest.budget} | Travelers: ${tripRequest.travelers} | Style: ${tripRequest.travelStyle}`
    );

    const result = await smartTravelPlannerWorkflow.execute({
      inputData: tripRequest,
    });

    console.log(
      `🎉 Travel plan complete! Duration: ${result.summary.duration} days`
    );
    return result;
  } catch (error) {
    console.error("❌ Travel planning failed:", error);
    throw error;
  }
}

export { smartTravelPlannerWorkflow };
