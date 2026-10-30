// Minimal GitHub contents API client. Each file is read with its sha and written
// back with that sha, so GitHub rejects a save that would overwrite a newer
// version. The caller then merges and retries.

export class ConflictError extends Error {}
export class AuthError extends Error {}

const API = 'https://api.github.com';
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function createClient({ owner, repo, token }, fetchImpl = (...a) => fetch(...a)) {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/`;
  const headers = (accept = 'application/vnd.github+json') => ({
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  });

  async function check(res) {
    if (res.status === 401 || res.status === 403) {
      throw new AuthError('GitHub refused the token. Check it has read and write access to this repo.');
    }
  }

  return {
    // Returns { data, sha } or null if the file does not exist yet.
    async read(path) {
      const res = await fetchImpl(base + path + `?t=${Date.now()}`, { headers: headers(), cache: 'no-store' });
      await check(res);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Could not read ${path} (${res.status})`);
      const meta = await res.json();
      let text;
      if (meta.content && meta.encoding === 'base64') text = fromBase64(meta.content);
      else text = await this.readRaw(path);
      return { data: JSON.parse(text), sha: meta.sha };
    },

    // For large, read-only files such as the calendar.
    async readRaw(path) {
      const res = await fetchImpl(base + path + `?t=${Date.now()}`, {
        headers: headers('application/vnd.github.raw+json'),
        cache: 'no-store',
      });
      await check(res);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Could not read ${path} (${res.status})`);
      return res.text();
    },

    // Attachments: binary files stored alongside the data.
    async readBlob(path) {
      const res = await fetchImpl(base + encodePath(path), {
        headers: headers('application/vnd.github.raw+json'),
        cache: 'force-cache',
      });
      await check(res);
      if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
      return res.blob();
    },

    async writeBinary(path, base64, message) {
      const res = await fetchImpl(base + encodePath(path), {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: base64 }),
      });
      await check(res);
      if (!res.ok) throw new Error(`Could not upload ${path.split('/').pop()} (${res.status})`);
      return (await res.json()).content.sha;
    },

    async remove(path, sha, message) {
      const res = await fetchImpl(base + encodePath(path), {
        method: 'DELETE',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sha }),
      });
      await check(res);
      if (!res.ok && res.status !== 404) throw new Error(`Could not delete ${path} (${res.status})`);
    },

    // Returns the new sha. Throws ConflictError if the file changed on GitHub.
    async write(path, data, sha, message) {
      const body = { message, content: toBase64(JSON.stringify(data, null, 1) + '\n') };
      if (sha) body.sha = sha;
      const res = await fetchImpl(base + path, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await check(res);
      if (res.status === 409 || res.status === 422) throw new ConflictError(`${path} changed on another device`);
      if (!res.ok) throw new Error(`Could not save ${path} (${res.status})`);
      const out = await res.json();
      return out.content.sha;
    },
  };
}
