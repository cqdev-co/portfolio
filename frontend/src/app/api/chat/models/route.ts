import { NextResponse } from "next/server";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 
  "https://ollama.com/api";

export type OllamaModel = {
  name: string;
  model: string;
  size: number;
  modified_at: string;
};

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Cache for 5 minutes
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    
    // Format models for the dropdown
    const models = (data.models || []).map((m: OllamaModel) => ({
      id: m.name,
      name: formatModelName(m.name),
      size: formatSize(m.size),
    }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch models",
        models: getDefaultModels(),
      },
      { status: 200 } // Return 200 with defaults on error
    );
  }
}

// Format model name for display
function formatModelName(name: string): string {
  // Remove version tags and clean up
  const parts = name.split(":");
  const baseName = parts[0]
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  const size = parts[1] || "";
  return size ? `${baseName} (${size})` : baseName;
}

// Format size to human readable
function formatSize(bytes: number): string {
  if (bytes === 0) return "Cloud";
  const gb = bytes / 1e9;
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)}TB`;
  return `${gb.toFixed(0)}GB`;
}

// Default models if API fails
function getDefaultModels() {
  return [
    { id: "gpt-oss:120b", name: "GPT-OSS (120b)", size: "65GB" },
    { id: "gpt-oss:20b", name: "GPT-OSS (20b)", size: "14GB" },
    { id: "deepseek-v3.2", name: "DeepSeek V3.2", size: "689GB" },
    { id: "qwen3-coder:480b", name: "Qwen3 Coder (480b)", size: "510GB" },
    { id: "gemma3:27b", name: "Gemma3 (27b)", size: "55GB" },
  ];
}

