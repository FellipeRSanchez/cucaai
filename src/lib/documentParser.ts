import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import * as mammoth from 'mammoth';

/**
 * Parses a buffer of a document and extracts raw text.
 * Supports PDF, DOCX, and TXT (fallback).
 */
export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      const data = await pdfParse(buffer);
      return data.text;
    } 
    
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    
    // Assume it's plain text if it's not PDF or DOCX
    return buffer.toString('utf-8');
  } catch (error) {
    console.error(`Error extracting text for mime type: ${mimeType}`, error);
    throw new Error('Failed to parse document content.');
  }
}

/**
 * Splits extracted text into semantic chunks of approx `maxChunkSize` characters,
 * respecting paragraph boundaries where possible.
 */
export function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
  // Simple paragraph-based splitting first
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  const chunks: string[] = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if ((currentChunk.length + p.length) > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep overlap from the end of the previous chunk
      currentChunk = currentChunk.slice(-overlap) + '\n\n' + p;
    } else {
      currentChunk += (currentChunk.length ? '\n\n' : '') + p;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Handle case where a single paragraph is larger than maxChunkSize
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > maxChunkSize * 1.5) {
      // Hard split
      for (let i = 0; i < chunk.length; i += maxChunkSize - overlap) {
        finalChunks.push(chunk.substring(i, i + maxChunkSize));
      }
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks;
}
