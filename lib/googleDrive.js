/* Google Drive integration for the Book Bank — an alternative storage backend to Supabase
   Storage for admins who've run out of the 1GB Supabase free-tier quota. Auth is via a service
   account (no OAuth flow, no user login) — the account must have the target Drive folder shared
   with it (Viewer access) before it can see anything, since service accounts have no Drive of
   their own. */
const { google } = require('googleapis');

let driveClient = null;
function getDrive() {
  if (driveClient) return driveClient;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/* Lists PDF/image files directly inside the given folder (non-recursive) that aren't already
   imported — caller passes the set of already-imported Drive file IDs to exclude. */
async function listFolderFiles(folderId, excludeIds) {
  const drive = getDrive();
  if (!drive) throw new Error('Google Drive is not configured (GOOGLE_SERVICE_ACCOUNT_JSON missing)');
  const exclude = new Set(excludeIds || []);
  const files = [];
  let pageToken;
  do {
    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/pdf' or mimeType contains 'image/')`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageSize: 200,
      pageToken
    });
    (data.files || []).forEach(f => { if (!exclude.has(f.id)) files.push(f); });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

async function getFileMeta(fileId) {
  const drive = getDrive();
  if (!drive) throw new Error('Google Drive is not configured');
  const { data } = await drive.files.get({ fileId, fields: 'id, name, mimeType, size' });
  return data;
}

/* Streams the raw file bytes straight through to an Express response — used so a teacher's
   browser never talks to Drive directly (Drive has no CORS support for this, unlike Supabase's
   signed URLs), while the app server never buffers the whole file in memory. */
async function streamFileTo(fileId, res) {
  const drive = getDrive();
  if (!drive) throw new Error('Google Drive is not configured');
  const meta = await getFileMeta(fileId);
  res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
  if (meta.size) res.setHeader('Content-Length', meta.size);
  const { data } = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  return new Promise((resolve, reject) => {
    data.on('end', resolve);
    data.on('error', reject);
    data.pipe(res);
  });
}

module.exports = { getDrive, listFolderFiles, getFileMeta, streamFileTo };
