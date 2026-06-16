import { asyncHandler } from "../utils/asyncHandler.js";
import s3 from "../db/aws.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ApiError } from "../utils/ApiError.js";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";
import { Material } from "../models/material.model.js";

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const GEMINI_EMBEDDING_DIMENSION = Number(process.env.GEMINI_EMBEDDING_DIMENSION || 1024);
const GEMINI_EMBEDDING_BATCH_SIZE = Number(process.env.GEMINI_EMBEDDING_BATCH_SIZE || 100);
const GEMINI_EMBEDDING_MAX_RETRIES = Number(process.env.GEMINI_EMBEDDING_MAX_RETRIES || 3);
const GEMINI_EMBEDDING_RETRY_DELAY_MS = Number(process.env.GEMINI_EMBEDDING_RETRY_DELAY_MS || 1000);
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "coaching-materials";
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || "materials";
const PINECONE_UPSERT_BATCH_SIZE = 100;

let pineconeClient;

const getPineconeClient = () => {
    if (!process.env.PINECONE_API_KEY) {
        throw new ApiError(500, "PINECONE_API_KEY is required to store embeddings");
    }

    if (!pineconeClient) {
        pineconeClient = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
    }

    return pineconeClient;
};

const AiEmbadding = async (s3key, unitId) => {

    /* 
        1. fatch file from s3 using s3key
        2. convert file to text
        3. split text into chunks
        4. generate embedding for each chunk
        5. store embedding into pinecone with metadata (unitId, s3key, chunkIndex, )
    */


    
    try {
        await markAsProcessing(s3key, unitId);

        // fatch file from s3 using s3key
        const fileContent = await fetchFileFromS3(s3key);
        console.log("--------------------------------------------------------------------------------");
        console.log("file fatched from S3 successfully");
        console.log("\nfileContent : \n\n", fileContent);
        // convert file to text
        const textContent = await convertFileToText(fileContent, s3key);
        console.log("--------------------------------------------------------------------------------");
        console.log("file converted to text successfully");
        console.log("\ntextContent : \n\n", textContent);

        // split text into chunks
        const textChunks = await splitTextIntoChunks(textContent);
        console.log("--------------------------------------------------------------------------------");
        console.log("text splitted into chunks successfully");
        console.log(`\nTotal Chunks : ${textChunks.length}\n\n`, textChunks);

        if (!textChunks.length) {
            throw new ApiError(400, "No text chunks found in this file");
        }

        const embeddings = await generateEmbeddings(textChunks);
        console.log("--------------------------------------------------------------------------------");
        console.log("embeddings generated successfully");
        console.log(`\nTotal Embeddings : ${embeddings.length}\n\n`, embeddings);

        // store embedding into pinecone with metadata (unitId, s3key, chunkIndex, )
        await storeEmbeddingsInPinecone({
            unitId,
            s3key,
            textChunks,
            embeddings
        });

        console.log("--------------------------------------------------------------------------------");
        console.log("embeddings stored in pinecone successfully");

        // mark the file as processed for ai embedding using s3key and unitId
        await markAsProcessed(s3key, unitId, textChunks.length);

        console.log("--------------------------------------------------------------------------------");
        console.log("file embedding process completed successfully in database");

        console.log("--------------------------------------------------------------------------------");
        console.log("AI embedding process completed successfully");
        return "AI embedding process completed";
    } catch (error) {
        await markAsFailed(s3key, unitId, error);
        throw error;
    }
    
};


const fetchFileFromS3 = async (s3key) => {
    // logic to fetch file from s3 using s3key


    try {

        // command
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: s3key
        })

        // send command to s3
        const response = await s3.send(command);

        return response.Body;
        
    } catch (error) {
        throw new ApiError(500, "Failed to fetch file from S3", [error.message], error.stack);
    } 

    // return file content
}

const convertFileToText = async (fileContent, s3key) => {
    // logic to convert file to text

    if (!fileContent) {
        throw new ApiError(500, "S3 file response body is empty");
    }

    const buffer = Buffer.from(
        await fileContent.transformToByteArray()
    ); 

    if (String(s3key).toLowerCase().endsWith(".txt")) {
        return buffer.toString("utf8");
    }

    try {
        const parser = new PDFParse({ data: buffer });
        try {
            const data = await parser.getText();

            return data.text;
        } finally {
            await parser.destroy();
        }
    }
    catch (error) {
        throw new ApiError(500, "Failed to convert file to text", [error.message], error.stack);
    }
}

const splitTextIntoChunks = async (textContent) => {
    // logic to split text into chunks using langchain text splitter
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
    });

    const chunks = await splitter.splitText(textContent || "");

    return chunks.map((chunk) => chunk.trim()).filter(Boolean); // this line is to remove empty chunks after trimming
};

const generateEmbedding = async (textChunk) => {
    // logic to generate embedding for each chunk using gemini api
    // return embedding vector
    const [embedding] = await generateEmbeddings([textChunk]);
    return embedding;
};


const prepareRetrievalDocument = (textChunk) => {
    return `title: none | text: ${textChunk}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableGeminiStatus = (status) => [429, 500, 502, 503, 504].includes(status);

const getRetryDelay = (response, attempt) => {
    const retryAfter = Number(response.headers.get("retry-after"));

    if (Number.isFinite(retryAfter) && retryAfter > 0) {
        return retryAfter * 1000;
    }

    return GEMINI_EMBEDDING_RETRY_DELAY_MS * 2 ** attempt;
};

const requestGeminiEmbeddingBatch = async (modelPath, batch) => {
    let lastError;

    for (let attempt = 0; attempt <= GEMINI_EMBEDDING_MAX_RETRIES; attempt += 1) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${modelPath}:batchEmbedContents`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": process.env.GEMINI_API_KEY
                    },
                    body: JSON.stringify({
                        requests: batch.map((textChunk) => ({
                            model: modelPath,
                            content: {
                                parts: [
                                    {
                                        text: prepareRetrievalDocument(textChunk)
                                    }
                                ]
                            },
                            output_dimensionality: GEMINI_EMBEDDING_DIMENSION
                        }))
                    })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                return data;
            }

            lastError = new Error(data?.error?.message || `Gemini embeddings request failed with status ${response.status}`);

            if (!isRetryableGeminiStatus(response.status) || attempt === GEMINI_EMBEDDING_MAX_RETRIES) {
                throw lastError;
            }

            const delay = getRetryDelay(response, attempt);
            console.warn(
                `Gemini embedding batch failed with status ${response.status}. Retrying in ${delay}ms (${attempt + 1}/${GEMINI_EMBEDDING_MAX_RETRIES})`
            );
            await sleep(delay);
        } catch (error) {
            lastError = error;

            if (attempt === GEMINI_EMBEDDING_MAX_RETRIES) {
                throw lastError;
            }

            const delay = GEMINI_EMBEDDING_RETRY_DELAY_MS * 2 ** attempt;
            console.warn(
                `Gemini embedding request failed: ${error.message}. Retrying in ${delay}ms (${attempt + 1}/${GEMINI_EMBEDDING_MAX_RETRIES})`
            );
            await sleep(delay);
        }
    }

    throw lastError;
};

const generateEmbeddings = async (textChunks) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new ApiError(500, "GEMINI_API_KEY is required to generate embeddings");
    }

    try {
        const modelPath = EMBEDDING_MODEL.startsWith("models/")
            ? EMBEDDING_MODEL
            : `models/${EMBEDDING_MODEL}`;
        const embeddings = [];

        for (let i = 0; i < textChunks.length; i += GEMINI_EMBEDDING_BATCH_SIZE) {
            const batch = textChunks.slice(i, i + GEMINI_EMBEDDING_BATCH_SIZE);
            const data = await requestGeminiEmbeddingBatch(modelPath, batch);

            if (!Array.isArray(data?.embeddings) || data.embeddings.length !== batch.length) {
                throw new Error("Gemini embedding count does not match text chunk count");
            }

            embeddings.push(...data.embeddings.map((item) => item.values));
        }

        return embeddings;
    } catch (error) {
        throw new ApiError(500, "Failed to generate embeddings", [error.message], error.stack);
    }
};

// build a unique vector id for each text chunk embedding to be stored in pinecone. 
// This will help in identifying and retrieving the embedding later based on unitId, s3key and chunkIndex.
const buildVectorId = (unitId, s3key, chunkIndex) => {
    const safeKey = Buffer.from(s3key).toString("base64url");
    return `${unitId}:${safeKey}:${chunkIndex}`;
};

const storeEmbeddingsInPinecone = async ({ unitId, s3key, textChunks, embeddings }) => {
    if (!PINECONE_INDEX_NAME) {
        throw new ApiError(500, "PINECONE_INDEX_NAME is required to store embeddings");
    }

    if (textChunks.length !== embeddings.length) {
        throw new ApiError(500, "Embedding count does not match text chunk count");
    }

    try {
        const pinecone = getPineconeClient();
        const index = pinecone.index({ name: PINECONE_INDEX_NAME }).namespace(PINECONE_NAMESPACE); // index is the name of the index in Pinecone, and namespace is a logical grouping of vectors within that index.
        const records = textChunks.map((chunk, chunkIndex) => ({
            id: buildVectorId(unitId, s3key, chunkIndex),
            values: embeddings[chunkIndex], 
            metadata: {
                unitId: String(unitId),
                s3key,
                chunkIndex,
                text: chunk,
                model: EMBEDDING_MODEL
            }
        }));

        for (let i = 0; i < records.length; i += PINECONE_UPSERT_BATCH_SIZE) {
            await index.upsert({
                records: records.slice(i, i + PINECONE_UPSERT_BATCH_SIZE)
            });
        }
    } catch (error) {
        throw new ApiError(500, "Failed to store embeddings in Pinecone", [error.message], error.stack);
    }
};

const updateMaterialEmbeddingStatus = async (s3key, unitId, update) => {
    await Material.findOneAndUpdate(
        { fileUrl: s3key, unit: unitId },
        { $set: update },
        { new: true }
    );
};

const markAsProcessing = async (s3key, unitId) => {
    await updateMaterialEmbeddingStatus(s3key, unitId, {
        aiEmbeddingStatus: "processing",
        aiEmbeddingError: null
    });
};

const markAsProcessed = async (s3key, unitId, chunkCount) => {
    await updateMaterialEmbeddingStatus(s3key, unitId, {
        aiEmbeddingStatus: "completed",
        aiEmbeddingChunkCount: chunkCount,
        aiEmbeddedAt: new Date(),
        aiEmbeddingError: null
    });
};

const markAsFailed = async (s3key, unitId, error) => {
    await updateMaterialEmbeddingStatus(s3key, unitId, {
        aiEmbeddingStatus: "failed",
        aiEmbeddingError: error?.message || "Embedding generation failed"
    });
};

const generateMaterialEmbeddings = asyncHandler(async (req, res) => {
    const { s3key, unitId } = req.body;

    if (!s3key || !unitId) {
        throw new ApiError(400, "s3key and unitId are required");
    }

    const message = await AiEmbadding(s3key, unitId);

    return res.status(200).json({
        success: true,
        message
    });
});

export {
    AiEmbadding,
    generateEmbedding,
    generateEmbeddings,
    generateMaterialEmbeddings
};
