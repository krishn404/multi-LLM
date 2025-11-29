"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { PromptInput } from "./prompt-input"
import { ModelSelector } from "./model-selector"
import { ComparisonResults } from "./comparison-results"
import { Button } from "@/components/ui/button"
import { ArrowIcon, LoadingSpinner } from "./icons"

export interface ModelResult {
  model: string
  modelName: string
  text: string
  responseTime: number
  tokensPerSecond: number
  totalTokens: number
  status: "pending" | "success" | "error"
  error?: string
}

// Production Models - Stable and recommended for production use
// Preview Models - For evaluation only, may be discontinued at short notice
const AVAILABLE_MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", tag: "Production" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", tag: "Fast" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout", tag: "Preview" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", tag: "Google" },
  { id: "huggingface-mixtral", name: "Mixtral 8x7B", tag: "Huggingface" },
  { id: "deepseek-chat", name: "DeepSeek Chat", tag: "DeepSeek" },
]

export function LLMComparison() {
  const [prompt, setPrompt] = useState("")
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "meta-llama/llama-4-scout-17b-16e-instruct",
  ])
  const [results, setResults] = useState<ModelResult[]>([])
  const [isComparing, setIsComparing] = useState(false)

  const handleCompare = async () => {
    if (!prompt.trim() || selectedModels.length === 0) return

    setIsComparing(true)
    setResults(
      selectedModels.map((modelId) => ({
        model: modelId,
        modelName: AVAILABLE_MODELS.find((m) => m.id === modelId)?.name || modelId,
        text: "",
        responseTime: 0,
        tokensPerSecond: 0,
        totalTokens: 0,
        status: "pending",
      })),
    )

    const promises = selectedModels.map(async (modelId) => {
      const startTime = performance.now()
      try {
        const response = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, model: modelId }),
        })

        const data = await response.json()
        const endTime = performance.now()
        const responseTime = (endTime - startTime) / 1000

        if (!response.ok) {
          throw new Error(data.error || "Failed to get response")
        }

        const totalTokens = data.usage?.totalTokens || 0
        const tokensPerSecond = responseTime > 0 ? totalTokens / responseTime : 0

        return {
          model: modelId,
          modelName: AVAILABLE_MODELS.find((m) => m.id === modelId)?.name || modelId,
          text: data.text,
          responseTime,
          tokensPerSecond,
          totalTokens,
          status: "success" as const,
        }
      } catch (error) {
        return {
          model: modelId,
          modelName: AVAILABLE_MODELS.find((m) => m.id === modelId)?.name || modelId,
          text: "",
          responseTime: 0,
          tokensPerSecond: 0,
          totalTokens: 0,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    })

    const completedResults = await Promise.all(promises)
    setResults(completedResults)
    setIsComparing(false)
  }

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) => (prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]))
  }

  return (
    <motion.div className="space-y-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <motion.div
        className="rounded-2xl border border-neutral-200/80 bg-white p-8 shadow-sm"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="space-y-8">
          <PromptInput value={prompt} onChange={setPrompt} disabled={isComparing} />

          <div className="h-px bg-neutral-100" />

          <ModelSelector
            models={AVAILABLE_MODELS}
            selectedModels={selectedModels}
            onToggle={toggleModel}
            disabled={isComparing}
          />

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCompare}
              disabled={isComparing || !prompt.trim() || selectedModels.length === 0}
              className="group h-11 gap-2 rounded-xl bg-neutral-900 px-6 text-sm font-medium text-white transition-all hover:bg-neutral-800 disabled:opacity-40"
            >
              {isComparing ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  <span>Comparing...</span>
                </>
              ) : (
                <>
                  <span>Compare Models</span>
                  <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {results.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <ComparisonResults results={results} />
        </motion.div>
      )}
    </motion.div>
  )
}
