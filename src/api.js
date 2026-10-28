export async function request(url, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(!isForm && options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    body: options.body && !isForm && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server could not be reached. Please try again.'); }
  if (!response.ok) { const error = new Error(data.error || 'Something went wrong.'); error.status = response.status; throw error; }
  return data;
}
export function initials(name) { return name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
