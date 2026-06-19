/**
 * PDF Parser Wrapper
 * Handles PDF parsing with proper error handling for serverless environments
 */

let PDFParseModule = null;

// Lazy load PDFParse only when needed
const getPDFParseModule = async () => {
    if (!PDFParseModule) {
        try {
            const module = await import("pdf-parse");
            PDFParseModule = module.PDFParse;
        } catch (error) {
            console.error("Failed to import PDFParse:", error);
            throw new Error("PDF parsing module failed to load");
        }
    }
    return PDFParseModule;
};

export const parseBuffer = async (buffer) => {
    const PDFParse = await getPDFParseModule();
    
    try {
        const parser = new PDFParse({ data: buffer });
        try {
            const data = await parser.getText();
            return data.text;
        } finally {
            await parser.destroy();
        }
    } catch (error) {
        console.error("PDF parsing error:", error);
        throw error;
    }
};

export const parsePDF = async (buffer, s3key) => {
    if (String(s3key).toLowerCase().endsWith(".txt")) {
        return buffer.toString("utf8");
    }
    
    if (String(s3key).toLowerCase().endsWith(".pdf")) {
        return parseBuffer(buffer);
    }
    
    throw new Error("Unsupported file format. Only PDF and TXT files are supported.");
};
