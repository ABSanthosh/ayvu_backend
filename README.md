# LaTeXML ArXiv Processing System

A sophisticated academic paper processing pipeline that converts ArXiv papers from LaTeX source to enhanced HTML with semantic embeddings and uploads them to Google Drive with real-time progress tracking.

## Overview

This system processes academic papers through a comprehensive pipeline:
1. Downloads LaTeX source from ArXiv
2. Converts to enhanced HTML using LaTeXML
3. Applies intelligent post-processing
4. Generates semantic embeddings for search
5. Uploads to Google Drive with public access
6. Provides real-time progress via Server-Sent Events

## Architecture Overview

The system follows an event-driven architecture with real-time progress updates via Server-Sent Events (SSE). Each processing step reports progress through a centralized `ProgressWorker` that broadcasts updates to connected clients.

## 1. Main Processing Pipeline (`src/main.ts`)

The `main.ts` file serves as the central orchestrator for the entire processing pipeline. It implements a REST API server using Oak framework.

### API Endpoints
- **GET `/`**: Basic health check endpoint
- **GET `/arxiv/:id`**: Main processing endpoint that handles the complete ArXiv paper processing workflow

### Processing Flow
The main processing pipeline follows this sequence:
1. **downloadArxivSource** - Downloads the source tarball from ArXiv
2. **extractTarball** - Extracts the LaTeX source files
3. **compileLatex** - Converts LaTeX to HTML using LaTeXML
4. **postprocess** - Cleans up and enhances the HTML
5. **cleanUpHTMLGeneration** - Removes temporary files
6. **generateWeights** - Creates embeddings for semantic search
7. **uploadPaper** - Uploads everything to Google Drive

### SSE Streaming Implementation
The system uses Server-Sent Events for real-time progress updates:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const userHash = progressWorker.registerClient(
      access_token,
      refresh_token,
      arxivId,
      controller
    );
    // Processing pipeline execution...
  }
});
```

The stream provides:
- Real-time progress updates for each processing step
- Error handling with detailed error messages
- Completion notifications
- Automatic cleanup on client disconnection

## 2. ProgressWorker Event-Driven Architecture (`src/progress/`)

The ProgressWorker implements a sophisticated event-driven progress tracking system that enables real-time updates to multiple clients.

### Core Architecture

#### Session Management
- **UserSession**: Maps user credentials to their active tasks and connected clients
- **ArxivTaskProgress**: Tracks progress for each paper processing task
- **Client Registration**: Associates SSE controllers with specific users and tasks

#### Hash-Based User Identification
```typescript
public userHash(accessToken: string, refreshToken: string): string {
  // Implements a deterministic hash function for user identification
  // Uses Google OAuth tokens to create unique user identifiers
}
```

#### Progress Tracking System
The system tracks six main processing steps:
- `DOWNLOAD_SOURCE`
- `EXTRACT_TARBALL`
- `COMPILE_LATEX`
- `POSTPROCESS`
- `GENERATE_WEIGHTS`
- `UPLOAD_TO_DRIVE`

Each step can have the following statuses:
- `PENDING` - Not yet started
- `IN_PROGRESS` - Currently executing
- `COMPLETED` - Successfully finished
- `FAILED` - Encountered an error

#### Event Broadcasting
```typescript
postProgress(update: ProgressUpdate) {
  // Updates step progress
  // Calculates overall status
  // Sends SSE updates to appropriate clients
  // Handles error scenarios and cleanup
}
```

The system supports:
- Multiple clients tracking the same task
- Automatic status aggregation
- Error propagation
- Client disconnection handling

## 3. Download and Extraction Functions (`src/process_arxiv.ts`)

### downloadArxivSource
This function handles downloading the source tarball from ArXiv:

```typescript
export async function downloadArxivSource(arxivId: string, ...): Promise<string>
```

**Process:**
1. Constructs ArXiv e-print URL: `https://arxiv.org/e-print/${arxivId}`
2. Downloads the tarball via fetch API
3. Creates necessary directory structure
4. Saves to `./tmp/${arxivId}/source.tar.gz`
5. Sends progress updates via ProgressWorker

**Error Handling:**
- Validates HTTP response status
- Provides detailed error messages for download failures

### extractTarball
Extracts the downloaded tarball using Deno's streaming APIs:

```typescript
export async function extractTarball(arxivId: string, ...): Promise<void>
```

**Process:**
1. Opens the compressed tarball
2. Uses `DecompressionStream("gzip")` for decompression
3. Pipes through `UntarStream()` for tar extraction
4. Creates directory structure as needed
5. Extracts files to `./tmp/${arxivId}/latex/`
6. Cleans up the original tarball

**Technical Details:**
- Uses streaming APIs to handle large files efficiently
- Normalizes file paths to prevent directory traversal
- Provides per-file extraction progress updates

## 4. LaTeX Compilation System (`src/process_latex.ts`)

The `compileLatex` function is the most complex component, responsible for converting LaTeX source to HTML using LaTeXML.

### Core Helper Functions

#### findTexFile
```typescript
async function findTexFile(latexDir: string): Promise<string | null>
```

**Purpose:** Intelligently identifies the main LaTeX file from potentially dozens of `.tex` files.

**Strategy:**
1. **Priority Pattern Matching**: Looks for common main file names:
   - `main.tex`
   - `paper.tex`
   - `manuscript.tex`
   - `article.tex`
   - `thesis.tex`
   - `document.tex`

2. **Document Class Detection**: If no priority files found, searches for files containing `\documentclass` in the first 50 lines

3. **Fallback**: Uses the first available `.tex` file

**Robustness Features:**
- Case-insensitive pattern matching
- Graceful handling of missing directories
- Comprehensive error logging

#### findStyFiles
```typescript
async function findStyFiles(latexDir: string): Promise<string[]>
```

**Purpose:** Locates all style files (`.sty`) needed for LaTeX compilation.

**Process:**
- Scans directory for `.sty` files (case-insensitive)
- Returns full paths for use in LaTeXML compilation
- Used to ensure custom style packages are available

#### findLtxmlFiles
```typescript
async function findLtxmlFiles(latexDir: string): Promise<string[]>
```

**Purpose:** Finds LaTeXML-specific configuration files (`.ltxml`).

**Usage:** These files contain LaTeXML-specific macros and configurations that help with the LaTeX→HTML conversion process.

### LaTeXML Compilation Process

The compilation uses extensive LaTeXML configuration:

```typescript
const latexmlArgs = [
  "--format=html5",
  "--nocomments",
  "--quiet",
  "--navigationtoc=context",
  "--nodefaultresources",
  "--timestamp=0",
  "--includestyles",
  // Multiple --path directives for package discovery
  // Preloaded packages for common LaTeX functionality
  // Custom engrafo.ltxml for enhanced output
]
```

**Key Features:**
- HTML5 output format
- Context-aware navigation TOC
- Preloaded common packages (amsmath, amsthm, graphicx, etc.)
- Custom styling and behavior modifications
- Extensive path configuration for package discovery

**Error Handling:**
- Captures compilation errors from stderr
- Provides detailed error messages
- Maintains working directory integrity

## 5. Post-processing and HTML Cleanup (`src/postprocessing/`)

### postprocess Function (`src/postprocessing/index.ts`)

The post-processing pipeline applies multiple transformations to enhance the generated HTML:

```typescript
export async function postprocess(arxivId: string, ...): Promise<void> {
  processFigures(document);
  processFootnotes(document);
  processHeadings(document);
  processLinks(document);
  processMath(document);
  processInlineStyles(document);
}
```

#### Individual Processing Functions:

**processFigures** (`figures.ts`):
- Reorders figure elements to place captions after images
- Ensures proper semantic structure for accessibility

**processFootnotes** (`footnotes.ts`):
- Relocates author footnotes to a dedicated section under authors
- Deduplicates footnotes with identical content
- Converts footnotes to numbered references
- Creates `.ltx_engrafo_author_notes` container for better styling

**processHeadings** (`headings.ts`):
- Converts ALL-CAPS headings to title case using the `titlecase` library
- Removes Unicode anomalies (e.g., full-width spaces)
- Applies consistent formatting across all heading levels

**processLinks** (`links.ts`):
- Automatically linkifies plain text URLs using `linkify-urls`
- Adds `http://` prefix to URLs missing protocols
- Preserves existing links and mailto references
- Uses tree walker to avoid processing existing link content

**processMath** (`math.ts`):
- Wraps display math with `\\[ ... \\]` for MathJax processing
- Wraps inline math with `\\( ... \\)`
- Creates scrollable containers for equation tables
- Adds `.ltx_DisplayMath` class for styling differentiation

**processInlineStyles** (`styles.ts`):
- Removes all inline `style` attributes
- Forces reliance on external CSS for consistent styling

### cleanUpHTMLGeneration (`src/postprocessing/html.ts`)

This function performs final cleanup:

```typescript
export async function cleanUpHTMLGeneration(arxivId: string, ...): Promise<void>
```

**Actions:**
1. Removes temporary files (`.log`, `.cache`) from HTML directory
2. Deletes the entire `latex` source directory to save space
3. Provides progress updates for each cleanup operation

**HTML Minification** (currently disabled):
- Includes `minifyHTML` function using `html-minifier-next`
- Comprehensive minification options for production optimization

## 6. Embedding Generation System (`src/embedding/`)

The embedding system creates semantic vectors for document search and retrieval.

### generateWeights Function (`src/embedding/index.ts`)

Main orchestration function:

```typescript
export async function generateWeights(
  arxivId: string,
  userHash?: string,
  progressWorker?: ProgressWorker,
  numChunks = 2048
): Promise<void>
```

**Process:**
1. Reads the processed HTML paper
2. Creates text chunks using the Chunker class
3. Initializes embedding model
4. Generates embeddings for all chunks
5. Saves embeddings to `embeddings.json`

**Key Implementation:**
```typescript
const index = result.payload.chunks.map((chunk, idx) => ({
  metadata: chunk,
  embedding: result.payload.embeddings[idx],
}));
```

### Embeddings Class (`src/embedding/worker.ts`)

The `Embeddings` class manages the machine learning model for generating semantic embeddings.

#### Architecture:
```typescript
export class Embeddings {
  private model: PreTrainedModel | null = null;
  private tokenizer: PreTrainedTokenizer | null = null;
  private taskQueue: Array<() => Promise<void>> = [];
}
```

#### Supported Models:
- `gte-small`: General text embedding model
- `embeddinggemma-300m-ONNX`: Specialized Gemma-based embedding model

#### Model Configuration:
```typescript
env.allowLocalModels = true;
env.localModelPath = "./models";
env.allowRemoteModels = false;
```

**Features:**
- Local-only model execution for privacy
- Quantized models (`dtype: "q4"`) for efficiency
- Progress callbacks for model loading
- Task queuing system for initialization handling

#### Embedding Generation Process:
```typescript
async startExtractEmbedding(chunks: Chunk[]): Promise<EmbeddingMessages>
```

**Text Preprocessing:**
```typescript
const inputs = chunks.map((chunk) => {
  const title = chunk.metadata.title || "none";
  const prefix = PREFIXES.document.replace("{title}", title);
  return `${prefix}${chunk.text}`;
});
```

**Technical Details:**
- Applies document-specific prefixes for better embedding quality
- Handles batch processing for efficiency
- Returns embeddings as nested arrays of numbers
- Comprehensive error handling and progress reporting

### Chunker Class (`src/embedding/chunker.ts`)

The `Chunker` class intelligently segments academic papers for embedding generation.

#### Core Architecture:
```typescript
export class Chunker {
  constructor(html: string, private maxChars: number, private overlap = 200)
}
```

#### Document Analysis Process:

**Table of Contents Extraction:**
```typescript
private extractHtmlAndToc(html: string): {
  toc: TocEntry[];
  contentBlocks: { id: string; text: string; hierarchy: string; }[];
}
```

**Process:**
1. **TOC Parsing**: Extracts navigation structure from `.ltx_TOC .ltx_tocentry`
2. **Hierarchy Detection**: Identifies sections, subsections, and subsubsections
3. **Parent Relationship Mapping**: Establishes document structure relationships
4. **Content Block Extraction**: Extracts text content while preserving structure

**Intelligent Sectioning:**
- Recognizes LaTeX document hierarchy (section → subsection → subsubsection)
- Maintains parent-child relationships (e.g., "S1.SS1" has parent "S1")
- Extracts content before child sections to avoid duplication

#### Chunking Strategy:
```typescript
private chunkText(text: string, maxChars: number, overlap: number): string[]
```

**Features:**
- **Overlapping Windows**: Ensures context preservation across chunk boundaries
- **Safety Mechanisms**: Prevents infinite loops with progress tracking
- **Size Management**: Configurable chunk sizes (default 2048 characters)
- **Structure Preservation**: Maintains section metadata in each chunk

#### Chunk Metadata:
```typescript
export interface Chunk {
  text: string;
  metadata: {
    sectionId: string;
    title: string;
    hierarchy: "section" | "subsection" | "subsubsection";
    parentSection?: string;
  };
}
```

**Benefits:**
- Enables section-aware search
- Preserves document structure for better retrieval
- Supports hierarchical navigation
- Maintains academic paper organization

## 7. Google Drive Integration (`src/process_drive.ts`)

The `MakeDriveGreatAgain` class handles uploading processed papers to Google Drive.

### Class Architecture:
```typescript
export default class MakeDriveGreatAgain {
  private drive: drive_v3.Drive;
  private userHash?: string;
  private progressWorker?: ProgressWorker;
}
```

**Authentication:**
- Uses Google OAuth2 with access and refresh tokens
- Initializes Google Drive API v3 client
- Supports token refresh for long-running operations

### uploadPaper Method:

The main upload process follows a systematic approach:

#### Step 1: Folder Structure Creation
```typescript
// 1. Check if the ".ayvu" folder exists in the root directory
let ayvuId = await this.isFolderExists(".ayvu", "root");
if (!ayvuId) {
  ayvuId = await this.createFolder(".ayvu", "root");
}

// 2. Inside ".ayvu", check if arxivId folder exists
let arxivFolderId = await this.isFolderExists(arxivId, ayvuId);
if (!arxivFolderId) {
  arxivFolderId = await this.createFolder(arxivId, ayvuId);
}
```

#### Step 2: File Upload with Progress Tracking
```typescript
const fileUploads = [];
for (const { name, file, size } of this.getFilesInDirectory(arxivId)) {
  if (!(await this.isFileExists(name, arxivFolderId))) {
    fileUploads.push(
      this.uploadFile(name, file, arxivFolderId, ({ bytesRead }) => {
        const progress = ((bytesRead / size) * 100).toFixed(2);
        // Progress updates via ProgressWorker
      })
    );
  }
}
await Promise.all(fileUploads);
```

### Key Helper Methods:

#### Folder Management:
- `isFolderExists`: Searches for folders by name and parent
- `isFileExists`: Checks for existing files to avoid duplicates
- `createFolder`: Creates new folders with public read permissions
- `makePublic`: Sets folder permissions for public access

#### File Operations:
- `getFilesInDirectory`: Scans local HTML directory for upload
- `uploadFile`: Handles resumable uploads with progress callbacks
- `getMimeType`: Determines appropriate MIME types for various file formats

#### Technical Features:
- **Parallel Uploads**: Uses `Promise.all()` for concurrent file uploads
- **Duplicate Prevention**: Checks existing files before upload
- **Progress Tracking**: Real-time upload progress for each file
- **Public Access**: Automatically makes folders publicly readable
- **MIME Type Detection**: Supports HTML, CSS, JS, images, and other formats
- **File Sorting**: Uploads smaller files first for faster initial progress

#### Error Handling:
- Comprehensive error messages for API failures
- Graceful handling of missing files or directories
- Detailed logging for debugging upload issues

## 8. Server-Sent Events (SSE) Streaming

The system implements sophisticated real-time communication using Server-Sent Events.

### Stream Implementation:
```typescript
const stream = new ReadableStream({
  async start(controller) {
    // Register client and process paper
  },
  cancel() {
    // Clean up on client disconnection
  }
});
```

### Message Format:
```typescript
interface ProgressEvent {
  type: "progress" | "complete" | "error";
  data: {
    arxivId: string;
    step?: ProcessingStep;
    progress?: StepProgress;
    overallStatus?: ProcessingStatus;
  };
}
```

### Key Features:
- **Real-time Updates**: Immediate progress notifications for each processing step
- **Error Propagation**: Detailed error messages with full context
- **Completion Tracking**: Overall progress aggregation across all steps
- **Client Management**: Automatic cleanup on disconnection
- **Multi-client Support**: Multiple clients can track the same paper processing

### Connection Management:
- User identification via OAuth token hashing
- Session-based client tracking
- Automatic cleanup on completion or error
- Graceful handling of network disconnections

## Getting Started

### Prerequisites
- Deno runtime
- LaTeXML installed and configured
- Google Drive API credentials
- Local ML models for embedding generation

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd latexml

# Install dependencies (handled by Deno)
deno cache src/main.ts
```

### Configuration
1. Set up LaTeXML paths in `src/process_latex.ts`
2. Configure model paths in `src/embedding/worker.ts`
3. Ensure Google Drive API credentials are properly configured

### Running the Server
```bash
deno run --allow-all src/main.ts
```

### API Usage
```bash
# Process an ArXiv paper
curl "http://localhost:8000/arxiv/2301.00001?access_token=TOKEN&refresh_token=REFRESH_TOKEN"
```

## File Structure

```
src/
├── main.ts                     # Main server and processing pipeline
├── process_arxiv.ts           # ArXiv download and extraction
├── process_latex.ts           # LaTeX compilation with LaTeXML
├── process_drive.ts           # Google Drive upload functionality
├── progress/
│   ├── progress.ts            # Progress tracking types and interfaces
│   └── progress-worker.ts     # Event-driven progress management
├── postprocessing/
│   ├── index.ts              # Main post-processing orchestrator
│   ├── figures.ts            # Figure element processing
│   ├── footnotes.ts          # Author footnote handling
│   ├── headings.ts           # Heading formatting and cleanup
│   ├── links.ts              # URL linkification and validation
│   ├── math.ts               # Mathematical notation processing
│   ├── styles.ts             # CSS and style cleanup
│   └── html.ts               # HTML cleanup and minification
└── embedding/
    ├── index.ts              # Embedding generation orchestrator
    ├── worker.ts             # ML model management and embedding creation
    └── chunker.ts            # Intelligent document chunking
```

## Summary

This system represents a sophisticated academic paper processing pipeline that efficiently handles the complex workflow of converting ArXiv papers into enhanced, searchable HTML documents. The architecture emphasizes reliability, progress transparency, and user experience while managing the technical challenges of academic document processing through an event-driven design that ensures scalability and responsiveness for production use with multiple concurrent users.