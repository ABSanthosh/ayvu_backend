// Progress tracking types for the ArXiv processing pipeline

export enum ProcessingStep {
  DOWNLOAD_SOURCE = "download_source",
  EXTRACT_TARBALL = "extract_tarball",
  COMPILE_LATEX = "compile_latex",
  POSTPROCESS = "postprocess",
  GENERATE_WEIGHTS = "generate_weights",
  UPLOAD_TO_DRIVE = "upload_to_drive",
}

export enum ProcessingStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface StepProgress {
  status: ProcessingStatus;
  progress?: number; // 0-100 percentage
  message?: string;
  error?: string;
}

export interface ArxivTaskProgress {
  arxivId: string;
  steps: Record<ProcessingStep, StepProgress>;
  overallStatus: ProcessingStatus;
  initiatingClient?: ReadableStreamDefaultController; // The specific client that started this task
}

export interface UserSession {
  userHash: string;
  tasks: Map<string, ArxivTaskProgress>; // arxivId -> progress
  clients: Map<string, ReadableStreamDefaultController>; // clientId -> SSE controller
}

export interface ProgressUpdate {
  userHash: string;
  arxivId: string;
  step: ProcessingStep;
  progress: Partial<StepProgress>;
  clientId?: string; // Optional client identifier to send updates to specific client
}

export interface ModuleProgress {
  step: ProcessingStep;
  status: ProcessingStatus;
  progress: Partial<StepProgress>;
}

export interface ProgressEvent {
  type: "progress" | "complete" | "error";
  data: {
    arxivId: string;
    step?: ProcessingStep;
    progress?: StepProgress;
    steps?: Record<ProcessingStep, StepProgress>;
    overallStatus?: ProcessingStatus;
  };
}
