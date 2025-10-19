import { drive_v3, google, Auth } from "googleapis";
import { Readable } from "node:stream";
import { ProgressWorker } from "./progress/progress-worker.ts";
import {
  ProcessingStatus,
  ProcessingStep,
  ProgressUpdate,
} from "./progress/progress.ts";

export default class MakeDriveGreatAgain {
  private drive: drive_v3.Drive;
  private userHash?: string;
  private progressWorker?: ProgressWorker;
  constructor({
    accessToken,
    refreshToken,
    userHash,
    progressWorker,
  }: {
    accessToken: string;
    refreshToken: string;
    userHash?: string;
    progressWorker?: ProgressWorker;
  }) {
    const auth: Auth.OAuth2Client = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.drive = google.drive({ version: "v3", auth });

    this.userHash = userHash;
    this.progressWorker = progressWorker;
  }

  async uploadPaper(arxivId: string): Promise<void> {
    // Before uploading, we need to follow some steps:
    // 1. Check if the ".ayvu" folder exists in the root directory of Google Drive.
    // 1.1. If it doesn't exist, create it.
    // 2. Inside the ".ayvu" folder, check if a folder with the name of the arxivId exists.
    // 2.1. If it doesn't exist, create it.
    // 3. Upload all files from the local directory "./tmp/{arxivId}/html" to the created/found folder in Google Drive using resumable uploads.

    // Step 1 and 1.1
    let ayvuId = await this.isFolderExists(".ayvu", "root");
    if (!ayvuId) {
      ayvuId = await this.createFolder(".ayvu", "root");
    }

    // Step 2 and 2.1
    let arxivFolderId = await this.isFolderExists(arxivId, ayvuId);
    if (!arxivFolderId) {
      arxivFolderId = await this.createFolder(arxivId, ayvuId);
    }

    const fileUploads = [];
    for (const { name, file, size } of this.getFilesInDirectory(arxivId)) {
      if (!(await this.isFileExists(name, arxivFolderId))) {
        // console.log(`Uploading file: ${name}`);
        fileUploads.push(
          this.uploadFile(name, file, arxivFolderId, ({ bytesRead }) => {
            const progress = ((bytesRead / size) * 100).toFixed(2);
            // console.log(`Uploading ${name}: ${progress}%`);
            this.progressWorker?.postProgress({
              userHash: this.userHash,
              arxivId,
              step: ProcessingStep.UPLOAD_TO_DRIVE,
              progress: {
                progress: +progress,
                status: ProcessingStatus.IN_PROGRESS,
                message: `Uploading file ${name}: ${progress}%`,
              },
            } as ProgressUpdate);
          })
        );
      }
    }

    await Promise.all(fileUploads);
  }

  // Abstract methods
  private async isFolderExists(
    folderName: string,
    parentId?: string
  ): Promise<string | null | undefined> {
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const response = await this.drive.files.list({
      q: query,
      fields: "files(id, name)",
    });

    const files = response.data.files;
    if (files && files.length > 0) {
      return files[0].id!;
    }
  }

  private async isFileExists(
    fileName: string,
    parentId?: string
  ): Promise<string | null | undefined> {
    let query = `name='${fileName}' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const response = await this.drive.files.list({
      q: query,
      fields: "files(id, name)",
    });

    const files = response.data.files;
    if (files && files.length > 0) {
      return files[0].id!;
    }
  }

  private async makePublic(folderId: string): Promise<void> {
    try {
      await this.drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    } catch (error) {
      console.error("Error making folder public:", error);
      throw error;
    }
  }

  private async createFolder(
    folderName: string,
    parentId?: string
  ): Promise<string> {
    const fileMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : [],
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    });

    if (response.data.id) {
      await this.makePublic(response.data.id);
      return response.data.id;
    } else {
      throw new Error("Failed to create folder");
    }
  }

  private async uploadFile(
    name: string,
    file: Deno.FsFile,
    folderId: string,
    onUploadProgress?: (progress: { bytesRead: number }) => void
  ): Promise<string> {
    // map file.readable.pipeTo function to a new method file.readable.pipe because googleapis library expects .pipe method
    // interface ReadableStreamWithPipe extends ReadableStream<Uint8Array> {
    //   pipe: typeof ReadableStream.prototype.pipeThrough;
    // }

    // const readableWithPipe = file.readable as ReadableStreamWithPipe;
    // readableWithPipe.pipe = file.readable.pipeThrough.bind(file.readable);
    const response = await this.drive.files.create(
      {
        requestBody: {
          name,
          parents: [folderId],
        },
        media: {
          mimeType: this.getMimeType(name),
          body: Readable.from(file.readable),
        },
        fields: "id",
        uploadType: "multipart",
        useContentAsIndexableText: false,
      },
      {
        onUploadProgress,
      }
    );

    if (response.data.id) {
      await this.makePublic(response.data.id);
      return response.data.id;
    } else {
      throw new Error("Failed to upload file");
    }
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split(".").pop();
    const mimeTypes: { [key: string]: string } = {
      html: "text/html",
      htm: "text/html",
      css: "text/css",
      js: "application/javascript",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      txt: "text/plain",
      xml: "application/xml",
    };

    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  private getFilesInDirectory(
    arxivId: string
  ): { name: string; size: number; file: Deno.FsFile }[] {
    const files: {
      name: string;
      size: number;
      file: Deno.FsFile;
    }[] = [];
    const dirPath = `./tmp/${arxivId}/html`;

    for (const entry of Deno.readDirSync(dirPath)) {
      if (entry.isFile) {
        const file = Deno.openSync(`${dirPath}/${entry.name}`);
        files.push({
          file,
          name: entry.name,
          size: file.statSync().size,
        });
      }
    }

    // Put smaller files first
    return files.sort((a, b) => a.size - b.size);
  }
}
