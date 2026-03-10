import { parsePdf } from "./pdf-parser"
import { parseDocx } from "./docx-parser"
import { parseMarkdown } from "./markdown-parser"
import { structureWorkout } from "./workout-structurer"
import { parseWithAI } from "./ai-parser"

export async function parsePlan(file: Buffer, fileName: string, mimeType: string) {
  let text: string

  if (mimeType === "application/pdf") {
    text = await parsePdf(file)
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    text = await parseDocx(file)
  } else {
    text = parseMarkdown(file)
  }

  if (!text.trim()) {
    throw new Error("Could not extract text from file")
  }

  // Try AI parsing first if API key is available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log("Using AI parser...")
      const result = await parseWithAI(text)
      if (result.weeks.length > 0) {
        return result
      }
      console.log("AI parser returned empty results, falling back to regex parser")
    } catch (err) {
      console.error("AI parser failed, falling back to regex:", err)
    }
  }

  // Fallback to regex-based parser
  console.log("Using regex parser...")
  return structureWorkout(text)
}
