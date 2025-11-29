import { createGroq } from "@ai-sdk/groq"
import { generateText } from "ai"

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set")
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1024,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Failed to generate text with Gemini")
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
  const usageMetadata = data.usageMetadata || {}

  return {
    text,
    usage: {
      promptTokens: usageMetadata.promptTokenCount || 0,
      completionTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    },
  }
}

async function callHuggingface(prompt: string) {
  const apiKey = process.env.HF_API_KEY
  if (!apiKey) {
    throw new Error("HF_API_KEY is not set")
  }

  // Format prompt for instruction-tuned model
  const formattedPrompt = `<s>[INST] ${prompt} [/INST]`

  const response = await fetch("https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: formattedPrompt,
      parameters: {
        max_new_tokens: 1024,
        return_full_text: false,
        temperature: 0.7,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || "Failed to generate text with Huggingface")
  }

  const data = await response.json()
  const text = Array.isArray(data) ? data[0]?.generated_text || "" : data.generated_text || ""

  // Huggingface doesn't provide token usage in the same format, so we estimate
  const estimatedTokens = Math.ceil(text.length / 4) + Math.ceil(prompt.length / 4)

  return {
    text: text.trim(),
    usage: {
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: Math.ceil(text.length / 4),
      totalTokens: estimatedTokens,
    },
  }
}

async function callDeepSeek(prompt: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set")
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Failed to generate text with DeepSeek")
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ""
  const usage = data.usage || {}

  return {
    text,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    },
  }
}

export async function POST(req: Request) {
  try {
    const { prompt, model } = await req.json()

    if (!prompt || !model) {
      return Response.json({ error: "Missing prompt or model" }, { status: 400 })
    }

    // Route to appropriate provider
    let result
    if (model === "gemini-1.5-flash") {
      result = await callGemini(prompt)
    } else if (model === "huggingface-mixtral") {
      result = await callHuggingface(prompt)
    } else if (model === "deepseek-chat") {
      result = await callDeepSeek(prompt)
    } else {
      // Default to Groq for existing models
      const { text, usage } = await generateText({
        model: groq(model),
        prompt,
        // @ts-ignore - maxTokens is supported but not in types
        maxTokens: 1024,
      })
      // Normalize usage object from AI SDK
      const normalizedUsage = {
        promptTokens: (usage as any)?.promptTokens ?? 0,
        completionTokens: (usage as any)?.completionTokens ?? 0,
        totalTokens: (usage as any)?.totalTokens ?? 0,
      }
      result = {
        text,
        usage: normalizedUsage,
      }
    }

    return Response.json({
      text: result.text,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
    })
  } catch (error) {
    console.error("Error generating text:", error)
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate text" }, { status: 500 })
  }
}
