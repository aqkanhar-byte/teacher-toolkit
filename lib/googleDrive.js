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

/* Lists PDF/image files inside the given folder AND any sub-folders (admins naturally organize
   STBB books into per-class/per-subject sub-folders) that aren't already imported — caller passes
   the set of already-imported Drive file IDs to exclude. Sub-folder files get their folder name
   prefixed (e.g. "Class 1/Book.pdf") so the admin can tell where each one came from. */
async function listFolderFiles(folderId, excludeIds) {
  const drive = getDrive();
  if (!drive) throw new Error('Google Drive is not configured (GOOGLE_SERVICE_ACCOUNT_JSON missing)');
  const exclude = new Set(excludeIds || []);
  const files = [];

  async function walk(id, pathPrefix) {
    let pageToken;
    do {
      const { data } = await drive.files.list({
        q: `'${id}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size)',
        pageSize: 200,
        pageToken
      });
      for (const f of data.files || []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          await walk(f.id, pathPrefix + f.name + '/');
        } else if ((f.mimeType === 'application/pdf' || f.mimeType.startsWith('image/')) && !exclude.has(f.id)) {
          files.push({ ...f, name: pathPrefix + f.name });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  await walk(folderId, '');
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
