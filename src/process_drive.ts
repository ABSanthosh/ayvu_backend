
import { walk } from "@std/fs/walk";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

interface DriveAuth {
  accessToken: string;
  refreshToken: string;
}

// Upload files from local directory to Google Drive folder
export async function uploadToGoogleDrive(
  arxivId: string,
  auth: DriveAuth
): Promise<string> {
  const localPath = `./tmp/${arxivId}/html`;
  
  try {
    // Check if the local directory exists
    const stat = await Deno.stat(localPath);
    if (!stat.isDirectory) {
      throw new Error(`${localPath} is not a directory`);
    }
  } catch (error) {
    throw new Error(`Local directory ${localPath} does not exist: ${error}`);
  }

  // Get or create the .ayvu folder
  const ayvuFolderId = await getOrCreateFolder(".ayvu", "root", auth);
  
  // Get or create the arxiv folder inside .ayvu
  const arxivFolderId = await getOrCreateFolder(arxivId, ayvuFolderId, auth);
  
  // Upload all files from the local directory
  await uploadDirectory(localPath, arxivFolderId, auth);
  
  return arxivFolderId;
}

// Get or create a folder in Google Drive
async function getOrCreateFolder(
  folderName: string,
  parentId: string,
  auth: DriveAuth
): Promise<string> {
  // First, check if the folder already exists
  const existingFolder = await findFolder(folderName, parentId, auth);
  if (existingFolder) {
    return existingFolder.id;
  }

  // Create the folder if it doesn't exist
  return await createFolder(folderName, parentId, auth);
}

// Find a folder by name in a parent folder
async function findFolder(
  folderName: string,
  parentId: string,
  auth: DriveAuth
): Promise<DriveFile | null> {
  const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search for folder: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

// Create a new folder in Google Drive
async function createFolder(
  folderName: string,
  parentId: string,
  auth: DriveAuth
): Promise<string> {
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };

  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.id;
}

// Upload a directory recursively to Google Drive
async function uploadDirectory(
  localPath: string,
  parentId: string,
  auth: DriveAuth
): Promise<void> {
  for await (const entry of walk(localPath, { includeFiles: true, includeDirs: false, skip: [/node_modules/, /\.git/] })) {
    if (entry.isFile) {
      // Upload file to Drive
      await uploadFile(entry.path, entry.name, parentId, auth);
    }
  }
  
  // Handle directories in a second pass to maintain structure
  for await (const entry of walk(localPath, { includeFiles: false, includeDirs: true, maxDepth: 1 })) {
    if (entry.isDirectory && entry.path !== localPath) {
      // Create folder in Drive
      const folderId = await getOrCreateFolder(entry.name, parentId, auth);
      // Recursively upload the directory contents
      await uploadDirectory(entry.path, folderId, auth);
    }
  }
}

// Upload a single file to Google Drive
async function uploadFile(
  filePath: string,
  fileName: string,
  parentId: string,
  auth: DriveAuth
): Promise<string> {
  // Read the file content
  const fileData = await Deno.readFile(filePath);
  
  // Determine MIME type based on file extension
  const mimeType = getMimeType(fileName);
  
  // Create metadata
  const metadata = {
    name: fileName,
    parents: [parentId],
  };

  // Use multipart upload to include metadata and file data
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadataPart = 
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata);

  const filePart = 
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n`;

  // Create the multipart body as Uint8Array
  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(metadataPart);
  const filePartBytes = encoder.encode(filePart);
  const closeDelimBytes = encoder.encode(closeDelim);

  const totalLength = metadataBytes.length + filePartBytes.length + fileData.length + closeDelimBytes.length;
  const multipartBody = new Uint8Array(totalLength);
  
  let offset = 0;
  multipartBody.set(metadataBytes, offset);
  offset += metadataBytes.length;
  multipartBody.set(filePartBytes, offset);
  offset += filePartBytes.length;
  multipartBody.set(fileData, offset);
  offset += fileData.length;
  multipartBody.set(closeDelimBytes, offset);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartBody,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file ${fileName}: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.id;
}

// Get MIME type based on file extension
function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeTypes: { [key: string]: string } = {
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'xml': 'application/xml',
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}