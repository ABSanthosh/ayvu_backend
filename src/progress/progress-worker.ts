import {
  ProcessingStep,
  ProcessingStatus,
  ArxivTaskProgress,
  UserSession,
  ProgressUpdate,
  ProgressEvent,
} from "./progress.ts";

export class ProgressWorker {
  public sessions = new Map<string, UserSession>();

  constructor() {}

  // Generate a user hash from accessToken and refreshToken
  public userHash(accessToken: string, refreshToken: string): string {
    const seed = 0;
    const str = accessToken + refreshToken;
    let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${4294967296 * (2097151 & h2) + (h1 >>> 0)}`;
  }

  // Initialize a new task for an arxivId
  private initializeTask(arxivId: string): ArxivTaskProgress {
    return {
      arxivId,
      steps: {
        [ProcessingStep.DOWNLOAD_SOURCE]: { status: ProcessingStatus.PENDING },
        [ProcessingStep.EXTRACT_TARBALL]: { status: ProcessingStatus.PENDING },
        [ProcessingStep.COMPILE_LATEX]: { status: ProcessingStatus.PENDING },
        [ProcessingStep.POSTPROCESS]: { status: ProcessingStatus.PENDING },
        [ProcessingStep.GENERATE_WEIGHTS]: { status: ProcessingStatus.PENDING },
        [ProcessingStep.UPLOAD_TO_DRIVE]: { status: ProcessingStatus.PENDING },
      },
      overallStatus: ProcessingStatus.PENDING,
    };
  }

  // Get or create a user session
  private getOrCreateSession(userHash: string): UserSession {
    if (!this.sessions.has(userHash)) {
      this.sessions.set(userHash, {
        userHash,
        tasks: new Map(),
        clients: new Map(),
      });
    }
    return this.sessions.get(userHash)!;
  }

  // Register a client for SSE updates
  public registerClient(
    accessToken: string,
    refreshToken: string,
    arxivId: string,
    controller: ReadableStreamDefaultController
  ): string {
    const userHash = this.userHash(accessToken, refreshToken);
    const clientId = userHash + "-" + arxivId;
    const session = this.getOrCreateSession(userHash);

    // Register the controller
    session.clients.set(clientId, controller);

    // Always initialize a fresh task for new requests
    // This ensures that subsequent requests get a clean slate
    const task = this.initializeTask(arxivId);
    task.initiatingClient = controller; // Track the initiating client
    session.tasks.set(arxivId, task);

    console.log(`Registered client ${clientId} for task ${arxivId}`);

    // Send initial progress state
    this.sendUpdate(controller, {
      type: "progress",
      data: {
        arxivId,
        steps: task.steps,
        overallStatus: task.overallStatus,
      },
    });

    return userHash;
  }

  // Post a progress update for a specific step
  postProgress(update: ProgressUpdate) {
    const { userHash, arxivId, step, progress, clientId } = update;
    const session = this.sessions.get(userHash);
    if (!session) {
      console.log(`No session found for userHash: ${userHash}`);
      return;
    }

    const task = session.tasks.get(arxivId);
    if (!task) {
      console.log(`No task found for arxivId: ${arxivId} in session: ${userHash}`);
      return;
    }

    // Update step progress
    task.steps[step] = {
      ...task.steps[step],
      ...progress,
    };

    console.log(`Updated step ${step} for ${arxivId}: ${progress.status}`);

    // Update overall status
    const allSteps = Object.values(task.steps);
    if (allSteps.every((s) => s.status === ProcessingStatus.COMPLETED)) {
      task.overallStatus = ProcessingStatus.COMPLETED;
    } else if (allSteps.some((s) => s.status === ProcessingStatus.FAILED)) {
      task.overallStatus = ProcessingStatus.FAILED;
    } else if (
      allSteps.some((s) => s.status === ProcessingStatus.IN_PROGRESS)
    ) {
      task.overallStatus = ProcessingStatus.IN_PROGRESS;
    }

    // Send update to the specific client (or initiating client)
    const controller = clientId
      ? session.clients.get(clientId)
      : task.initiatingClient;
    
    if (controller) {
      try {
        this.sendUpdate(controller, {
          type:
            task.overallStatus === ProcessingStatus.COMPLETED
              ? "complete"
              : task.overallStatus === ProcessingStatus.FAILED
              ? "error"
              : "progress",
          data: {
            arxivId,
            step,
            progress: task.steps[step],
            overallStatus: task.overallStatus,
          },
        });
      } catch (error) {
        console.error(`Failed to send progress update: ${error}`);
        // Controller might be closed, remove it from clients
        if (clientId) {
          session.clients.delete(clientId);
        }
      }
    } else {
      console.log(`No controller found for client: ${clientId || 'initiating client'}`);
    }

    // Note: We don't clean up tasks here anymore - let the main.ts handle cleanup
    // This prevents race conditions where cleanup interferes with ongoing processing
  }

  // Clean up a specific client and task
  public cleanupClient(userHash: string, arxivId: string): void {
    const session = this.sessions.get(userHash);
    if (!session) return;

    const clientId = userHash + "-" + arxivId;
    
    // Remove the client
    session.clients.delete(clientId);
    console.log(`Cleaned up client: ${clientId}`);
    
    // Remove the task
    session.tasks.delete(arxivId);
    console.log(`Cleaned up task: ${arxivId}`);
    
    // Remove session if empty
    if (session.tasks.size === 0 && session.clients.size === 0) {
      this.sessions.delete(userHash);
      console.log(`Cleaned up session: ${userHash}`);
    }
  }

  // Send an SSE update to a client
  private sendUpdate(
    controller: ReadableStreamDefaultController,
    event: ProgressEvent
  ) {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    controller.enqueue(new TextEncoder().encode(message));
  }
}
