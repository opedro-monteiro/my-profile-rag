import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface TextSplitterConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export async function loadAndSplitPdf(
  pdfPath: string,
  textSplitterConfig: TextSplitterConfig,
): Promise<Document[]> {
  const rawDocuments = await new PDFLoader(pdfPath).load();
  const splitter = new RecursiveCharacterTextSplitter(textSplitterConfig);
  const documents = await splitter.splitDocuments(rawDocuments);

  return documents.map((document) => ({
    ...document,
    metadata: { source: document.metadata.source },
  }));
}
