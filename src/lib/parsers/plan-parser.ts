import { parsePdf } from "./pdf-parser"
import { parseDocx } from "./docx-parser"
import { parseMarkdown } from "./markdown-parser"
import { structureWorkout } from "./workout-structurer"

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

  return structureWorkout(text)
}
