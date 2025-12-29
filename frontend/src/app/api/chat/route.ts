import { 
  createUIMessageStream, 
  createUIMessageStreamResponse 
} from "ai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Shared AI agent library (monorepo root)
import { 
  buildVictorLitePrompt,
  BASIC_TOOLS,
  toOllamaTools,
  executeToolCall,
} from "@lib/ai-agent";

export const maxDuration = 60;

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 
  "https://ollama.com/api";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "gpt-oss:120b";

// ============================================================================
// AI CHAT WHITELIST
// Only these email addresses can use the AI chat feature
// ============================================================================
const AI_CHAT_WHITELIST: string[] = [
  "melonshd88@gmail.com",
  "conorquinlan@icloud.com",
  "conor.quinlan@cyera.io"
  // Add more emails here as needed
];

/**
 * Check if a user is authorized to use the AI chat
 */
async function isUserAuthorized(): Promise<{ authorized: boolean; email?: string; error?: string }> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { authorized: false, error: "Not authenticated. Please sign in to use the AI chat." };
    }

    const email = user.email?.toLowerCase();
    if (!email) {
      return { authorized: false, error: "No email associated with your account." };
    }

    // Check if email is in whitelist
    const isWhitelisted = AI_CHAT_WHITELIST.some(
      (whitelistedEmail) => whitelistedEmail.toLowerCase() === email
    );

    if (!isWhitelisted) {
      return { 
        authorized: false, 
        email,
        error: "Your account is not authorized to use the AI chat. Contact the administrator for access." 
      };
    }

    return { authorized: true, email };
  } catch (err) {
    console.error("[Chat Auth] Error checking authorization:", err);
    return { authorized: false, error: "Authentication error. Please try again." };
  }
}

// Use Victor Lite prompt with tools enabled
const systemPrompt = buildVictorLitePrompt({ 
  accountSize: 1500,
  withTools: true,  // Enable tool instructions
});

// Convert tools to Ollama format
const ollamaTools = toOllamaTools(BASIC_TOOLS);

// Extract text content from UIMessage parts or direct content
function extractContent(msg: {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  // Try parts array first (AI SDK 6.0 UIMessage format)
  if (msg.parts && Array.isArray(msg.parts)) {
    return msg.parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("");
  }
  // Fall back to direct content
  return msg.content || "";
}

// Type for tool call from Ollama
interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export async function POST(req: Request) {
  try {
    // ============================================
    // AUTHORIZATION CHECK
    // ============================================
    const authResult = await isUserAuthorized();
    
    if (!authResult.authorized) {
      console.log(`[Chat] Unauthorized access attempt: ${authResult.email || "unknown"}`);
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized",
          message: authResult.error,
        }),
        { 
          status: 401, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }
    
    console.log(`[Chat] Authorized user: ${authResult.email}`);
    
    // ============================================
    // PROCESS CHAT REQUEST
    // ============================================
    const { messages, model } = await req.json();

    // Use provided model or default
    const selectedModel = model || DEFAULT_MODEL;

    // Convert messages to Ollama format
    const ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg: {
        role: string;
        content?: string;
        parts?: Array<{ type: string; text?: string }>;
      }) => ({
        role: msg.role,
        content: extractContent(msg),
      })),
    ];

    // Create UI message stream for proper AI SDK 6.0 format
    const stream = createUIMessageStream({
      async execute({ writer }) {
        // Track thinking state OUTSIDE recursive function so it persists
        let globalThinkingMode = false;
        
        // Recursive function to handle tool calls
        async function processChat(msgs: typeof ollamaMessages) {
          // Include tools for models that support them
          const requestBody = {
            model: selectedModel,
            messages: msgs,
            tools: ollamaTools,
            stream: true,
          };
          
          console.log(`[Chat] Sending request to ${selectedModel} with tools`);
          
        const response = await fetch(`${OLLAMA_BASE_URL}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(OLLAMA_API_KEY && { 
              Authorization: `Bearer ${OLLAMA_API_KEY}` 
            }),
          },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          
          // Parse specific error types for better client handling
          if (response.status === 429) {
            throw new Error("Rate limit reached. Please wait a moment before trying again.");
          }
          if (response.status === 503 || response.status === 502) {
            throw new Error("AI service is temporarily unavailable. Please try again.");
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error("Authentication error. Please check your API configuration.");
          }
          
          throw new Error(
            `Ollama API error: ${response.status} - ${errorText}`
          );
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textId: string | null = null;
        let buffer = "";
          let pendingToolCalls: OllamaToolCall[] = [];
          let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const json = JSON.parse(line);
                
                // Debug: log first response chunk
                if (!textId) {
                  console.log("[Chat] First response chunk:", 
                    JSON.stringify(json).slice(0, 200));
                }
                
                // Handle tool calls
                if (json.message?.tool_calls) {
                  pendingToolCalls = json.message.tool_calls;
                  console.log(`[Chat] Tool calls detected:`, 
                    JSON.stringify(pendingToolCalls).slice(0, 200));
                }
              
              // Handle thinking/reasoning content (DeepSeek R1 style)
              // DeepSeek uses 'reasoning_content' field for chain-of-thought
              const thinking = json.message?.reasoning_content || json.message?.thinking;
              if (thinking) {
                // Start text if not started
                if (!textId) {
                  textId = crypto.randomUUID();
                  writer.write({ type: "text-start", id: textId });
                }
                
                // Emit thinking start marker ONCE
                if (!globalThinkingMode) {
                  globalThinkingMode = true;
                  writer.write({
                    type: "text-delta",
                    id: textId,
                    delta: "<!--THINKING_START-->",
                  });
                }
                
                // Write thinking content
                writer.write({
                  type: "text-delta",
                  id: textId,
                  delta: thinking,
                });
                }
                
                // Handle text content - check both formats
                const content = json.message?.content || json.response;
                if (content) {
                  assistantContent += content;
                  
                // Start text if not started
                if (!textId) {
                  textId = crypto.randomUUID();
                  writer.write({ type: "text-start", id: textId });
                }
                
                // Close thinking mode ONCE when we get actual content
                if (globalThinkingMode) {
                  globalThinkingMode = false;
                  writer.write({
                    type: "text-delta",
                    id: textId,
                    delta: "<!--THINKING_END-->",
                  });
                }

                // Write text delta
                writer.write({
                  type: "text-delta",
                  id: textId,
                    delta: content,
                });
              }

                // End of stream - handle tool calls if any
                if (json.done) {
                  console.log(`[Chat] Stream done. Pending tools: ${pendingToolCalls.length}`);
                  
                  // Close any open text
                  if (textId) {
                writer.write({
                  type: "text-end",
                  id: textId,
                });
                    textId = null;
                  }
                  
                  // Process tool calls
                  if (pendingToolCalls.length > 0) {
                    // Add assistant message to history
                    const newMsgs = [
                      ...msgs,
                      { 
                        role: "assistant", 
                        content: assistantContent || null,
                        tool_calls: pendingToolCalls,
                      },
                    ];
                    
                    // Execute each tool call
                    for (const tc of pendingToolCalls) {
                      const toolName = tc.function.name;
                      const toolArgs = tc.function.arguments;
                      
                      console.log(`[Chat] Executing tool: ${toolName}`, toolArgs);
                      
                      // Emit tool start marker for UI
                      const startMarkerId = crypto.randomUUID();
                      writer.write({ type: "text-start", id: startMarkerId });
                      writer.write({ 
                        type: "text-delta", 
                        id: startMarkerId, 
                        delta: `<!--TOOL_START:${toolName}:${
                          JSON.stringify(toolArgs)
                        }:START-->` 
                      });
                      writer.write({ type: "text-end", id: startMarkerId });
                      
                      // Execute the tool with Ollama API key for web search
                      const result = await executeToolCall(
                        { name: toolName, arguments: toolArgs },
                        { apiKey: OLLAMA_API_KEY }
                      );
                      
                      // Detailed logging for debugging
                      console.log(`[Chat] Tool ${toolName} result:`, {
                        success: result.success,
                        hasData: !!result.data,
                        hasFormatted: !!result.formatted,
                        error: result.error,
                      });
                      
                      // Always emit a tool result marker for UI tracking
                      const markerId = crypto.randomUUID();
                      writer.write({ type: "text-start", id: markerId });
                      
                      if (result.success && result.data) {
                        // Success - emit full data
                        let dataJson: string;
                        try {
                          dataJson = JSON.stringify(result.data);
                        } catch (e) {
                          console.error("[Chat] Failed to stringify tool data:", e);
                          dataJson = JSON.stringify({ 
                            error: "Failed to serialize",
                            ticker: toolArgs.ticker || "unknown" 
                          });
                        }
                        
                        const toolMarker = `<!--TOOL:${toolName}:${dataJson}:TOOL-->`;
                        console.log(`[Chat] Emitting success marker (${toolMarker.length} chars)`);
                        writer.write({ type: "text-delta", id: markerId, delta: toolMarker });
                      } else {
                        // Error - emit error marker so UI shows failure state
                        const errorData = JSON.stringify({
                          error: result.error || "Unknown error",
                          ticker: toolArgs.ticker || toolArgs.query || "unknown",
                        });
                        const errorMarker = `<!--TOOL_ERROR:${toolName}:${errorData}:ERROR-->`;
                        console.log(`[Chat] Emitting error marker: ${result.error}`);
                        writer.write({ type: "text-delta", id: markerId, delta: errorMarker });
                      }
                      
                      writer.write({ type: "text-end", id: markerId });
                      
                      // Add tool result to messages for Ollama
                      newMsgs.push({
                        role: "tool",
                        content: result.formatted || 
                          result.error || 
                          JSON.stringify(result.data),
                        tool_call_id: `${toolName}_${Date.now()}`,
                      } as typeof newMsgs[number]);
                    }
                    
                    // Continue conversation with tool results
                    await processChat(newMsgs);
                  }
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }

        // Handle any remaining buffer
        if (buffer.trim()) {
          try {
            const json = JSON.parse(buffer);
              const bufferContent = json.message?.content || json.response;
              if (bufferContent && textId) {
              writer.write({
                type: "text-delta",
                id: textId,
                  delta: bufferContent,
              });
            }
            if (json.done && textId) {
              writer.write({
                type: "text-end",
                id: textId,
              });
            }
          } catch {
            // Ignore
          }
        }

        // Ensure text is ended if we started one
        if (textId) {
          writer.write({
            type: "text-end",
            id: textId,
          });
        }
        }
        
        // Start processing
        await processChat(ollamaMessages);
      },
      onError: (error) => {
        console.error("Stream error:", error);
        return error instanceof Error ? error.message : "Unknown error";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Chat API error:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Unknown error";
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to process chat request",
        details: errorMessage,
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}
