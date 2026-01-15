import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-3-flash-preview';

export const generateChatResponse = async (
  history: { role: string; text: string }[],
  userMessage: string,
  context?: AnalysisResult
): Promise<string> => {
  
  if (!apiKey) {
    return "I'm sorry, I cannot process your request because the API Key is missing. Please configure the application with a valid Gemini API Key.";
  }

  try {
    let systemInstruction = `You are an expert Census Quality Scoring Agent for Group Life Insurance. 
    Your role is to assist the user (Insurance Operations or Broker) in understanding the quality of their census data.
    
    You have access to a specific analysis report if provided.
    
    TONE: Professional, analytical, helpful, and concise.
    
    WHAT YOU DO:
    - Explain the "Risk Score".
    - Highlight specific data issues (missing salaries, EOI risks).
    - Suggest operational next steps.
    
    WHAT YOU DO NOT DO:
    - You do NOT offer to change the data yourself.
    - You do NOT make underwriting decisions.
    
    If analysis data is present, refer to specific numbers (e.g., "The 4 missing salaries are lowering your completeness score").
    If the user uploads a file, acknowledge it and summarize the findings based on the provided JSON context.
    `;

    if (context) {
      systemInstruction += `\n\nCURRENT ANALYSIS CONTEXT: ${JSON.stringify(context)}`;
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        ...history.map(h => ({
          role: h.role,
          parts: [{ text: h.text }]
        })),
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ],
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "I processed the data, but I couldn't generate a verbal summary. Please check the dashboard.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I encountered an error while communicating with the AI service. Please try again.";
  }
};