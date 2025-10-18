import { drive_v3, google, Auth } from "googleapis";
import { Readable } from "node:stream";

export default class MakeDriveGreatAgain {
  private drive: drive_v3.Drive;
  constructor({
    accessToken,
    refreshToken,
  }: {
    accessToken: string;
    refreshToken: string;
  }) {
    const auth: Auth.OAuth2Client = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.drive = google.drive({ version: "v3", auth });
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
        console.log(`Uploading file: ${name}`);
        fileUploads.push(
          this.uploadFile(name, file, arxivFolderId, ({ bytesRead }) => {
            const progress = ((bytesRead / size) * 100).toFixed(2);
            console.log(`Uploading ${name}: ${progress}%`);
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

export async function uploadToGoogleDrive(
  arxivId: string,
  { accessToken, refreshToken }: { accessToken: string; refreshToken: string }
): Promise<string> {
  // Initialize OAuth2 client
  const oAuth2Client = new google.auth.OAuth2();
  oAuth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const drive = google.drive({ version: "v3", auth: oAuth2Client });

  // read files in ".ayvu" folder in drive if it exists(to test if it works)
  const folderName = `.ayvu`;

  drive.files
    .list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
    })
    .then((response) => {
      const files = response.data.files;
      if (files && files.length > 0) {
        console.log(
          `Folder ${folderName} already exists with ID: ${files[0].id}`
        );
      } else {
        console.log(`Folder ${folderName} does not exist.`);
      }
    })
    .catch((error) => {
      console.error("Error searching for folder:", error);
    });

  return "folderId-placeholder";
}

const findFolder = async (
  service: drive_v3.Drive,
  folderName: string,
  parentId?: string
): Promise<string | null | undefined> => {
  try {
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const response = await service.files.list({
      q: query,
      fields: "files(id, name)",
    });

    const files = response.data.files;
    if (files && files.length > 0) {
      return files[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Error finding folder ${folderName}:`, error);
    throw error;
  }
};

// async function createFolder(folderName: string){

// }
