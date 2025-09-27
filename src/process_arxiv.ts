import { UntarStream } from "@std/tar/untar-stream";
import { dirname, normalize } from "@std/path";

export async function downloadArxivSource(arxivId: string): Promise<string> {
  const tarPath = `./tmp/${arxivId}/source.tar.gz`;
  const sourceUrl = `https://arxiv.org/e-print/${arxivId}`;

  // Download the source tarball
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download source from arXiv: ${response.statusText}`
    );
  }

  await Deno.mkdir(dirname(tarPath), { recursive: true });
  await Deno.writeFile(tarPath, new Uint8Array(await response.arrayBuffer()));

  return tarPath;
}

export async function extractTarball(arxivId: string): Promise<void> {
  const tarPath = `./tmp/${arxivId}/source.tar.gz`;

  for await (const entry of (await Deno.open(tarPath)).readable
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new UntarStream())) {
    const path = normalize(`./tmp/${arxivId}/latex/${entry.path}`);
    await Deno.mkdir(dirname(path), { recursive: true });
    await entry.readable?.pipeTo((await Deno.create(path)).writable);
  }

  await Deno.remove(tarPath);
}
