import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { GeocodingResponse, WeatherForecastResponse } from "../../types";
import { generateFallbackWeather, getWeatherCondition } from "../../helpers";

// =============== ROBUST WEATHER TOOL ===============

export const weatherForecastTool = createTool({
  id: "get-weather-forecast",
  description: "Get detailed weather forecast for a destination and date range",
  inputSchema: z.object({
    destination: z.string().describe("Destination city/country"),
    startDate: z.string().describe("Start date (YYYY-MM-DD)"),
    endDate: z.string().describe("End date (YYYY-MM-DD)"),
  }),
  outputSchema: z.object({
    destination: z.string(),
    country: z.string(),
    forecast: z.array(
      z.object({
        date: z.string(),
        condition: z.string(),
        maxTemp: z.number(),
        minTemp: z.number(),
        precipitationChance: z.number(),
        weatherCode: z.number(),
      })
    ),
    summary: z.string(),
  }),
  execute: async ({ context }) => {
    const { destination, startDate, endDate } = context;

    console.log(
      `🌤️ [Weather Tool] Starting weather forecast for ${destination}`
    );
    console.log(`📅 [Weather Tool] Date range: ${startDate} to ${endDate}`);

    try {
      // Step 1: Get coordinates for destination
      console.log(
        `🗺️ [Weather Tool] Getting coordinates for ${destination}...`
      );

      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        destination
      )}&count=1`;
      console.log(`🔗 [Weather Tool] Geocoding URL: ${geocodingUrl}`);

      const geocodingResponse = await fetch(geocodingUrl);

      if (!geocodingResponse.ok) {
        console.warn(
          `⚠️ [Weather Tool] Geocoding API error: ${geocodingResponse.status}`
        );
        return generateFallbackWeather(destination, startDate, endDate);
      }

      const geocodingData =
        (await geocodingResponse.json()) as GeocodingResponse;
      console.log(
        `📍 [Weather Tool] Geocoding response:`,
        JSON.stringify(geocodingData, null, 2)
      );

      if (!geocodingData.results?.[0]) {
        console.warn(`⚠️ [Weather Tool] Location not found: ${destination}`);
        return generateFallbackWeather(destination, startDate, endDate);
      }

      const { latitude, longitude, name, country } = geocodingData.results[0];
      console.log(
        `✅ [Weather Tool] Found coordinates: ${latitude}, ${longitude} for ${name}, ${country}`
      );

      // Step 2: Get weather forecast with multiple fallback attempts
      const weatherAttempts = [
        // Attempt 1: Full forecast with all parameters
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=time,weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${startDate}&end_date=${endDate}`,
        // Attempt 2: Simplified forecast
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=time,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`,
        // Attempt 3: Current weather only
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&timezone=auto`,
      ];

      let weatherData: WeatherForecastResponse | null = null;

      for (let i = 0; i < weatherAttempts.length; i++) {
        const weatherUrl = weatherAttempts[i];
        console.log(`🌦️ [Weather Tool] Attempt ${i + 1}: ${weatherUrl}`);

        try {
          const weatherResponse = await fetch(weatherUrl);

          if (!weatherResponse.ok) {
            console.warn(
              `⚠️ [Weather Tool] Weather API error (attempt ${i + 1}): ${
                weatherResponse.status
              }`
            );
            continue;
          }

          const rawData = await weatherResponse.json();
          console.log(
            `📊 [Weather Tool] Raw weather data (attempt ${i + 1}):`,
            JSON.stringify(rawData, null, 2)
          );

          if (rawData.daily || rawData.current) {
            weatherData = rawData as WeatherForecastResponse;
            console.log(
              `✅ [Weather Tool] Successfully got weather data on attempt ${
                i + 1
              }`
            );
            break;
          }
        } catch (error) {
          console.warn(
            `⚠️ [Weather Tool] Weather fetch error (attempt ${i + 1}):`,
            error
          );
          continue;
        }
      }

      // Step 3: Process weather data or use fallback
      if (!weatherData?.daily?.time || !Array.isArray(weatherData.daily.time)) {
        console.warn(
          `⚠️ [Weather Tool] Invalid weather data structure, using fallback`
        );
        return generateFallbackWeather(name, startDate, endDate);
      }

      console.log(
        `🎯 [Weather Tool] Processing ${weatherData.daily.time.length} days of weather data`
      );

      // Process forecast data safely
      const forecast = weatherData.daily.time.map((date, index) => ({
        date,
        condition: getWeatherCondition(
          weatherData.daily?.weathercode?.[index] || 1
        ),
        maxTemp: Math.round(
          weatherData.daily?.temperature_2m_max?.[index] || 25
        ),
        minTemp: Math.round(
          weatherData.daily?.temperature_2m_min?.[index] || 18
        ),
        precipitationChance:
          weatherData.daily?.precipitation_probability_max?.[index] || 20,
        weatherCode: weatherData.daily?.weathercode?.[index] || 1,
      }));

      // Generate summary
      const avgTemp =
        forecast.reduce(
          (sum, day) => sum + (day.maxTemp + day.minTemp) / 2,
          0
        ) / forecast.length;
      const rainyDays = forecast.filter(
        (day) => day.precipitationChance > 50
      ).length;
      const summary = `${
        forecast.length
      } day forecast for ${name}: Average temperature ${Math.round(
        avgTemp
      )}°C, ${rainyDays} potentially rainy days.`;

      console.log(
        `✅ [Weather Tool] Successfully generated weather forecast for ${name}`
      );

      return {
        destination: name,
        country: country || "Unknown",
        forecast,
        summary,
      };
    } catch (error) {
      console.error(`❌ [Weather Tool] Unexpected error:`, error);
      console.log(
        `🔄 [Weather Tool] Using fallback weather data for ${destination}`
      );

      return generateFallbackWeather(destination, startDate, endDate);
    }
  },
});

// =============== OTHER TOOLS  ===============

export const destinationResearchTool = createTool({
  id: "research-destination",
  description:
    "Research comprehensive destination information including culture, costs, and safety",
  inputSchema: z.object({
    destination: z.string().describe("Destination to research"),
    travelStyle: z
      .enum(["budget", "mid-range", "luxury"])
      .describe("Travel style preference"),
    travelers: z.number().describe("Number of travelers"),
  }),
  outputSchema: z.object({
    destination: z.string(),
    country: z.string(),
    currency: z.string(),
    bestTimeToVisit: z.string(),
    culturalTips: z.array(z.string()),
    safetyLevel: z
      .enum(["low", "medium", "high"])
      .describe("Safety risk level"),
    estimatedDailyCosts: z.object({
      accommodation: z.number(),
      food: z.number(),
      transport: z.number(),
      activities: z.number(),
      total: z.number(),
    }),
    keyAttractions: z.array(z.string()),
    localCuisine: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { destination, travelStyle, travelers } = context;

    console.log(
      `🔍 [Research Tool] Researching ${destination} for ${travelers} travelers (${travelStyle} style)`
    );

    try {
      // Try to get real location data
      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        destination
      )}&count=1`;
      const geocodingResponse = await fetch(geocodingUrl);

      let locationName = destination;
      let countryName = "Unknown";

      if (geocodingResponse.ok) {
        const geocodingData =
          (await geocodingResponse.json()) as GeocodingResponse;
        if (geocodingData.results?.[0]) {
          locationName = geocodingData.results[0].name;
          countryName = geocodingData.results[0].country || "Unknown";
        }
      }

      console.log(
        `✅ [Research Tool] Location: ${locationName}, ${countryName}`
      );

      // Generate destination data based on travel style
      const costMultipliers: Record<string, number> = {
        budget: 1,
        "mid-range": 1.8,
        luxury: 3.5,
      };
      const multiplier = costMultipliers[travelStyle] || 1.8;

      const destinationData = {
        destination: locationName,
        country: countryName,
        currency: "USD", // Simplified for demo
        bestTimeToVisit: "Spring and Fall for optimal weather conditions",
        culturalTips: [
          "Respect local customs and dress codes when visiting religious sites",
          "Learn basic phrases in the local language - locals appreciate the effort",
          "Understand local tipping etiquette and payment customs",
          "Be aware of cultural taboos and sensitive topics in conversation",
          "Follow local dining etiquette and meal timing customs",
        ],
        safetyLevel: "medium" as const,
        estimatedDailyCosts: {
          accommodation: Math.round(50 * multiplier),
          food: Math.round(30 * multiplier),
          transport: Math.round(15 * multiplier),
          activities: Math.round(25 * multiplier),
          total: Math.round(120 * multiplier),
        },
        keyAttractions: [
          "Historic City Center and Old Town",
          "National Museum and Cultural Sites",
          "Local Markets and Shopping Districts",
          "Scenic Viewpoints and Observation Decks",
          "Traditional Cultural Districts",
          "Modern Entertainment Areas",
        ],
        localCuisine: [
          "Traditional street food and local specialties",
          "Regional dishes unique to this area",
          "Local beverages and traditional drinks",
          "Seasonal delicacies and fresh ingredients",
          "Popular restaurant chains and cafes",
        ],
      };

      console.log(
        `✅ [Research Tool] Generated comprehensive data for ${locationName}`
      );
      return destinationData;
    } catch (error) {
      console.error(`❌ [Research Tool] Error:`, error);

      // Fallback data
      return {
        destination: destination.split(",")[0].trim(),
        country: "Unknown",
        currency: "USD",
        bestTimeToVisit: "Year-round with seasonal variations",
        culturalTips: ["Research local customs before visiting"],
        safetyLevel: "medium" as const,
        estimatedDailyCosts: {
          accommodation: 60,
          food: 35,
          transport: 20,
          activities: 30,
          total: 145,
        },
        keyAttractions: ["Main attractions", "Cultural sites"],
        localCuisine: ["Local specialties"],
      };
    }
  },
});

export const budgetCalculatorTool = createTool({
  id: "calculate-budget",
  description: "Calculate detailed budget breakdown for a trip",
  inputSchema: z.object({
    totalBudget: z.number().describe("Total available budget"),
    duration: z.number().describe("Trip duration in days"),
    travelers: z.number().describe("Number of travelers"),
    travelStyle: z.enum(["budget", "mid-range", "luxury"]),
    destination: z.string().describe("Destination for cost calculations"),
  }),
  outputSchema: z.object({
    totalBudget: z.number(),
    dailyBudget: z.number(),
    breakdown: z.object({
      accommodation: z.object({
        percentage: z.number(),
        total: z.number(),
        daily: z.number(),
      }),
      food: z.object({
        percentage: z.number(),
        total: z.number(),
        daily: z.number(),
      }),
      transport: z.object({
        percentage: z.number(),
        total: z.number(),
        daily: z.number(),
      }),
      activities: z.object({
        percentage: z.number(),
        total: z.number(),
        daily: z.number(),
      }),
      miscellaneous: z.object({
        percentage: z.number(),
        total: z.number(),
        daily: z.number(),
      }),
    }),
    recommendations: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { totalBudget, duration, travelers, travelStyle, destination } =
      context;

    console.log(
      `💰 [Budget Tool] Calculating budget: ${totalBudget} for ${duration} days, ${travelers} travelers (${travelStyle})`
    );

    const dailyBudget = totalBudget / duration;

    // Budget allocation percentages based on travel style
    const allocations: Record<string, Record<string, number>> = {
      budget: {
        accommodation: 35,
        food: 30,
        transport: 15,
        activities: 15,
        misc: 5,
      },
      "mid-range": {
        accommodation: 40,
        food: 25,
        transport: 15,
        activities: 15,
        misc: 5,
      },
      luxury: {
        accommodation: 45,
        food: 20,
        transport: 15,
        activities: 15,
        misc: 5,
      },
    };

    const allocation = allocations[travelStyle] || allocations["mid-range"];

    const breakdown = {
      accommodation: {
        percentage: allocation.accommodation,
        total: Math.round((totalBudget * allocation.accommodation) / 100),
        daily: Math.round((dailyBudget * allocation.accommodation) / 100),
      },
      food: {
        percentage: allocation.food,
        total: Math.round((totalBudget * allocation.food) / 100),
        daily: Math.round((dailyBudget * allocation.food) / 100),
      },
      transport: {
        percentage: allocation.transport,
        total: Math.round((totalBudget * allocation.transport) / 100),
        daily: Math.round((dailyBudget * allocation.transport) / 100),
      },
      activities: {
        percentage: allocation.activities,
        total: Math.round((totalBudget * allocation.activities) / 100),
        daily: Math.round((dailyBudget * allocation.activities) / 100),
      },
      miscellaneous: {
        percentage: allocation.misc,
        total: Math.round((totalBudget * allocation.misc) / 100),
        daily: Math.round((dailyBudget * allocation.misc) / 100),
      },
    };

    // Generate recommendations
    const recommendations = [
      `Based on your ${travelStyle} travel style and $${Math.round(
        dailyBudget
      )}/day budget`,
      "Book accommodations in advance for better rates and availability",
      "Mix restaurant meals with local street food for authentic experiences",
      "Use public transport when possible to save money and experience local life",
      "Look for free walking tours and attractions to maximize your budget",
    ];

    if (dailyBudget < 50) {
      recommendations.push(
        "Consider hostels or budget guesthouses for accommodation"
      );
      recommendations.push(
        "Cook some meals if kitchen facilities are available"
      );
    } else if (dailyBudget > 200) {
      recommendations.push("Consider boutique hotels or luxury resorts");
      recommendations.push(
        "Budget for unique experiences and private guided tours"
      );
    }

    console.log(
      `✅ [Budget Tool] Budget calculated: $${Math.round(
        dailyBudget
      )}/day with ${recommendations.length} recommendations`
    );

    return {
      totalBudget,
      dailyBudget: Math.round(dailyBudget),
      breakdown,
      recommendations,
    };
  },
});

export const attractionsFinderTool = createTool({
  id: "find-attractions",
  description:
    "Find top attractions and activities for a destination based on interests",
  inputSchema: z.object({
    destination: z.string().describe("Destination to find attractions for"),
    interests: z.array(z.string()).describe("Traveler interests"),
    duration: z.number().describe("Trip duration in days"),
    budget: z.number().describe("Activities budget per day"),
  }),
  outputSchema: z.object({
    destination: z.string(),
    attractions: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
        estimatedCost: z.number(),
        timeNeeded: z.string(),
        bestTimeToVisit: z.string(),
        rating: z.number(),
        category: z.string(),
      })
    ),
    totalAttractions: z.number(),
    categories: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { destination, interests, duration, budget } = context;

    console.log(`🎯 [Attractions Tool] Finding attractions for ${destination}`);
    console.log(`🎨 [Attractions Tool] Interests: [${interests.join(", ")}]`);
    console.log(
      `📅 [Attractions Tool] Duration: ${duration} days, Budget: ${budget}/day`
    );

    // Enhanced attraction database based on interests
    const allAttractions = [
      {
        name: "Historic Cathedral or Temple",
        type: "Cultural Site",
        description:
          "Beautiful architecture with rich history and guided tours available",
        estimatedCost: 15,
        timeNeeded: "2-3 hours",
        bestTimeToVisit: "Morning",
        rating: 4.5,
        category: "culture",
      },
      {
        name: "Local Food Market",
        type: "Culinary Experience",
        description:
          "Authentic local cuisine and fresh ingredients from regional vendors",
        estimatedCost: 25,
        timeNeeded: "2-4 hours",
        bestTimeToVisit: "Late morning",
        rating: 4.7,
        category: "food",
      },
      {
        name: "Nature Park or Garden",
        type: "Outdoor Activity",
        description:
          "Scenic walking trails with local flora and peaceful atmosphere",
        estimatedCost: 10,
        timeNeeded: "Half day",
        bestTimeToVisit: "Early morning",
        rating: 4.3,
        category: "nature",
      },
      {
        name: "Art Museum or Gallery",
        type: "Cultural Site",
        description:
          "Contemporary and classical art collections with rotating exhibitions",
        estimatedCost: 20,
        timeNeeded: "3-4 hours",
        bestTimeToVisit: "Afternoon",
        rating: 4.2,
        category: "art",
      },
      {
        name: "Adventure Activity Center",
        type: "Adventure Activity",
        description:
          "Outdoor adventures like hiking, climbing, or water sports",
        estimatedCost: 45,
        timeNeeded: "Full day",
        bestTimeToVisit: "Morning",
        rating: 4.6,
        category: "adventure",
      },
      {
        name: "Technology Museum",
        type: "Educational Site",
        description:
          "Interactive exhibits showcasing modern technology and innovation",
        estimatedCost: 18,
        timeNeeded: "3-4 hours",
        bestTimeToVisit: "Afternoon",
        rating: 4.4,
        category: "technology",
      },
      {
        name: "Shopping District",
        type: "Shopping Experience",
        description: "Local shops, boutiques, and markets for unique souvenirs",
        estimatedCost: 30,
        timeNeeded: "Half day",
        bestTimeToVisit: "Afternoon",
        rating: 4.1,
        category: "shopping",
      },
      {
        name: "Historical Walking Tour",
        type: "Cultural Experience",
        description:
          "Guided tour through historic neighborhoods with local stories",
        estimatedCost: 20,
        timeNeeded: "3 hours",
        bestTimeToVisit: "Morning",
        rating: 4.8,
        category: "history",
      },
    ];

    // Filter attractions based on interests and budget
    const matchedAttractions = allAttractions.filter((attraction) => {
      const matchesInterest = interests.some(
        (interest: string) =>
          attraction.category.toLowerCase().includes(interest.toLowerCase()) ||
          attraction.type.toLowerCase().includes(interest.toLowerCase()) ||
          attraction.name.toLowerCase().includes(interest.toLowerCase())
      );
      const withinBudget = attraction.estimatedCost <= budget * 2; // Allow some flexibility

      return matchesInterest || withinBudget;
    });

    // Ensure we have enough attractions for the duration
    const minAttractions = Math.min(duration * 2, allAttractions.length);
    const finalAttractions =
      matchedAttractions.length >= minAttractions
        ? matchedAttractions
        : [
            ...matchedAttractions,
            ...allAttractions
              .filter((a) => !matchedAttractions.includes(a))
              .slice(0, minAttractions - matchedAttractions.length),
          ];

    const categories = [...new Set(finalAttractions.map((a) => a.category))];

    console.log(
      `✅ [Attractions Tool] Found ${finalAttractions.length} attractions in ${categories.length} categories`
    );

    return {
      destination: destination.split(",")[0].trim(),
      attractions: finalAttractions,
      totalAttractions: finalAttractions.length,
      categories,
    };
  },
});
