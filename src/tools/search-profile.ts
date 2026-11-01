import { tool } from "langchain";
import * as z from "zod";
import { formatContext, retrieveProfileChunks } from "../rag/retriever.ts";

export const searchProfile = tool(
  async ({ question }) => {
    const chunks = await retrieveProfileChunks(question);
    return formatContext(chunks);
  },
  {
    name: "search_profile",
    description:
      "Search Pedro Monteiro's professional profile. Use it for any question about him: experience, jobs, projects, skills, education, certifications, languages or contact details.",
    schema: z.object({
      question: z
        .string()
        .describe(
          "Search query in English, because the profile is written in English. Translate the user's question when needed.",
        ),
    }),
  },
);
