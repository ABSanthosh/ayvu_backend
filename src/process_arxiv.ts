import { UntarStream } from "@std/tar/untar-stream";
import { dirname, normalize } from "@std/path";
import {
  ProcessingStatus,
  ProcessingStep,
  ProgressUpdate,
} from "./progress/progress.ts";
import { ProgressWorker } from "./progress/progress-worker.ts";

export async function downloadArxivSource(
  arxivId: string,
  userHash?: string,
  progressWorker?: ProgressWorker
): Promise<string> {
  const tarPath = `./tmp/${arxivId}/source.tar.gz`;
  const sourceUrl = `https://arxiv.org/e-print/${arxivId}`;

  // Download the source tarball
  progressWorker?.postProgress({
    userHash,
    arxivId,
    step: ProcessingStep.DOWNLOAD_SOURCE,
    progress: {
      status: ProcessingStatus.IN_PROGRESS,
      message: "Starting download of source tarball",
    },
  } as ProgressUpdate);

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download source from arXiv: ${response.statusText}`
    );
  }
  progressWorker?.postProgress({
    userHash,
    arxivId,
    step: ProcessingStep.DOWNLOAD_SOURCE,
    progress: {
      status: ProcessingStatus.COMPLETED,
      message: "Completed download of source tarball",
    },
  } as ProgressUpdate);

  await Deno.mkdir(dirname(tarPath), { recursive: true });
  await Deno.writeFile(tarPath, new Uint8Array(await response.arrayBuffer()));

  console.log(`Downloaded source tarball to ${tarPath}`);
  return tarPath;
}

export async function extractTarball(
  arxivId: string,
  userHash?: string,
  progressWorker?: ProgressWorker
): Promise<void> {
  const tarPath = `./tmp/${arxivId}/source.tar.gz`;

  for await (const entry of (await Deno.open(tarPath)).readable
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new UntarStream())) {
    const path = normalize(`./tmp/${arxivId}/latex/${entry.path}`);

    progressWorker?.postProgress({
      userHash,
      arxivId,
      step: ProcessingStep.EXTRACT_TARBALL,
      progress: {
        status: ProcessingStatus.IN_PROGRESS,
        message: `Extracting ${entry.path}`,
      },
    } as ProgressUpdate);
    await Deno.mkdir(dirname(path), { recursive: true });
    await entry.readable?.pipeTo((await Deno.create(path)).writable);
  }

  progressWorker?.postProgress({
    userHash,
    arxivId,
    step: ProcessingStep.EXTRACT_TARBALL,
    progress: {
      status: ProcessingStatus.COMPLETED,
      message: "Completed extraction of source tarball",
    },
  } as ProgressUpdate);

  console.log(`Extracted source tarball for ${arxivId}`);

  await Deno.remove(tarPath);
}
