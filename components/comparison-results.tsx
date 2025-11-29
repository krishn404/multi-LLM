"use client"

import { motion } from "framer-motion"
import type { ModelResult } from "./llm-comparison"
import { ResultCard } from "./result-card"

interface ComparisonResultsProps {
  results: ModelResult[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export function ComparisonResults({ results }: ComparisonResultsProps) {
  const completeCount = results.filter((r) => r.status === "success").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Results</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {results.map((r, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`h-1.5 w-1.5 rounded-full ${
                  r.status === "success" ? "bg-neutral-900" : r.status === "error" ? "bg-red-400" : "bg-neutral-300"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-neutral-400">
            {completeCount}/{results.length}
          </span>
        </div>
      </div>

      <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" variants={containerVariants} initial="hidden" animate="visible">
        {results.map((result) => (
          <motion.div key={result.model} variants={itemVariants}>
            <ResultCard result={result} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
