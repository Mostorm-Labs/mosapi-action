import fs from 'fs';
import path from 'path';
import glob from '@actions/glob';

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

export async function run(env = process.env) {
  const token = env.INPUT_TOKEN;
  const artifacts = env.INPUT_ARTIFACTS;
  const folderId = env.INPUT_FOLDER_ID;
  const productId = env.INPUT_PRODUCT_ID;
  const version = env.INPUT_VERSION;

  if (!token) throw new Error('Input required and not supplied: token');
  if (!artifacts) throw new Error('Input required and not supplied: artifacts');
  if (!folderId) throw new Error('Input required and not supplied: folder-id');
  if (!productId) throw new Error('Input required and not supplied: product-id');
  if (!version) throw new Error('Input required and not supplied: version');

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
  const productSlug = env.INPUT_PRODUCT_SLUG || 'nearhub-launch-windows';

  return { token, artifacts, folderId, productId, version, endpoint, ifNoFilesFound, retries, changelog, state, type, productSlug };
}
