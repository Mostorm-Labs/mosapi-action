import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import glob from '@actions/glob';
import * as coreModule from '@actions/core';

export function getFileMd5(filePath) {
  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileContent).digest('hex');
}

export const actionCore = {
  setOutput: coreModule.setOutput,
  warning: coreModule.warning,
  info: coreModule.info,
  setFailed: coreModule.setFailed
};

export async function resolveFiles(artifactsPattern) {
  const globber = await glob.create(artifactsPattern);
  const matchedPaths = await globber.glob();
  const files = [];
  for (const p of matchedPaths) {
    if (fs.statSync(p).isFile()) {
      files.push(p);
    }
  }
  return files;
}

export async function uploadFile(filePath, { token, folderId, endpoint, retries }) {
  const fileName = path.basename(filePath);
  const formData = new FormData();
  const fileContent = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileContent]);
  formData.append('files', fileBlob, fileName);
  formData.append('fileInfo', JSON.stringify({ name: fileName, folder: folderId }));

  let attempt = 0;
  const maxAttempts = 1 + retries;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: token,
        },
        body: formData,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        const excerpt = bodyText.substring(0, 100);
        throw new Error(`Upload failed with status: ${response.status}. Response: ${excerpt}`);
      }

      const responseData = await response.json();
      if (!responseData || !responseData[0]) {
        throw new Error('Upload succeeded but returned empty list');
      }

      return responseData[0];
    } catch (err) {
      attempt++;
      console.log(`Attempt ${attempt} failed for ${fileName}:`, err.message);
      if (attempt >= maxAttempts) {
        throw err;
      }
    }
  }
}

export async function createUpdateRecord({
  endpoint,
  token,
  productId,
  version,
  changelog,
  state,
  type,
  productSlug,
  otaFiles
}) {
  const baseEndpoint = endpoint.endsWith('/upload')
    ? endpoint.replace(/\/upload$/, '/updates')
    : endpoint + '/updates';

  const date = new Date().toISOString();
  const slug = `${productSlug}-${version}__${date}`;

  const payload = {
    slug,
    version,
    date,
    state,
    type,
    products: {
      disconnect: [],
      connect: [
        {
          id: parseInt(productId, 10),
          position: {
            end: true
          }
        }
      ]
    },
    descriptions: [
      {
        locale: 'en-us',
        content: changelog
      },
      {
        locale: 'zh-cn',
        content: changelog
      }
    ],
    otaFiles,
    imgFiles: [],
    extFiles: []
  };

  // POST request
  const postResponse = await fetch(baseEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify({ data: payload })
  });

  if (!postResponse.ok) {
    const errorBody = await postResponse.text();
    throw new Error(`Failed to create update record. Status: ${postResponse.status}. Response: ${errorBody.substring(0, 100)}`);
  }

  const postResult = await postResponse.json();
  const newId = postResult.data.id;

  // GET request
  const getResponse = await fetch(`${baseEndpoint}/${newId}?populate[otaFiles][populate]=*`, {
    headers: {
      Authorization: token
    }
  });

  if (!getResponse.ok) {
    const errorBody = await getResponse.text();
    throw new Error(`Failed to fetch populated update record. Status: ${getResponse.status}. Response: ${errorBody.substring(0, 100)}`);
  }

  const getResult = await getResponse.json();
  return {
    ...getResult.data.attributes,
    id: getResult.data.id
  };
}

export async function run(env = process.env) {
  const token = env.INPUT_TOKEN;
  const artifacts = env.INPUT_ARTIFACTS;
  const folderId = env.INPUT_FOLDER_ID;
  const productId = env.INPUT_PRODUCT_ID;
  const version = env.INPUT_VERSION;
  const productSlug = env.INPUT_PRODUCT_SLUG;

  if (!token) throw new Error('Input required and not supplied: token');
  if (!artifacts) throw new Error('Input required and not supplied: artifacts');
  if (!folderId) throw new Error('Input required and not supplied: folder-id');
  if (!productId) throw new Error('Input required and not supplied: product-id');
  if (!version) throw new Error('Input required and not supplied: version');
  if (!productSlug) throw new Error('Input required and not supplied: product-slug');

  const endpoint = env.INPUT_ENDPOINT || 'https://mosapi-admin.auditoryworks.co/v1/upload';
  const ifNoFilesFound = env.INPUT_IF_NO_FILES_FOUND || 'error';
  const retries = parseInt(env.INPUT_RETRIES || '3', 10);

  let changelog = env.INPUT_CHANGELOG;
  if (!changelog) {
    const tempPath = path.resolve(process.cwd(), 'temp_changelog.txt');
    if (fs.existsSync(tempPath)) {
      changelog = fs.readFileSync(tempPath, 'utf-8');
    } else {
      changelog = 'New release with several bug fixes and improvements.';
    }
  }

  const state = env.INPUT_STATE || 'alpha';
  const type = env.INPUT_TYPE || 'optional';

  const files = await resolveFiles(artifacts);

  if (files.length === 0) {
    if (ifNoFilesFound === 'error') {
      throw new Error('No files found matching the specified pattern.');
    } else if (ifNoFilesFound === 'warn') {
      actionCore.warning('No files found matching the specified pattern.');
    } else {
      actionCore.info('No files found matching the specified pattern.');
    }
    actionCore.setOutput('uploaded-count', 0);
    actionCore.setOutput('uploaded-files', JSON.stringify([]));
    return;
  }

  actionCore.info(`Found ${files.length} file(s) to upload.`);
  const uploadedFilesResult = [];
  const otaFiles = [];

  for (const file of files) {
    actionCore.info(`Uploading ${file}...`);
    const result = await uploadFile(file, { token, folderId, endpoint, retries });
    actionCore.info(`Uploaded ${file} -> id=${result.id}`);

    const md5 = getFileMd5(file);
    actionCore.info(`Calculated MD5 for ${file} -> ${md5}`);

    uploadedFilesResult.push({
      path: file,
      name: path.basename(file),
      id: result.id,
      url: result.url,
      md5,
      ...result
    });
    otaFiles.push({
      type: path.basename(file),
      file: { id: result.id },
      md5
    });
  }

  actionCore.info(`Uploaded ${files.length} file(s) successfully.`);
  actionCore.setOutput('uploaded-count', files.length);
  actionCore.setOutput('uploaded-files', JSON.stringify(uploadedFilesResult));

  actionCore.info('Creating update record on Mosapi...');
  const updateRecord = await createUpdateRecord({
    endpoint,
    token,
    productId,
    version,
    changelog,
    state,
    type,
    productSlug,
    otaFiles
  });

  actionCore.info(`Created update record successfully. ID: ${updateRecord.id}, Slug: ${updateRecord.slug}`);
  actionCore.setOutput('update-id', updateRecord.id);
  actionCore.setOutput('update-slug', updateRecord.slug);
}

if (process.argv[1] && (process.argv[1].endsWith('upload.js') || process.argv[1].endsWith('upload'))) {
  run().catch(err => {
    actionCore.setFailed(err.message);
  });
}
