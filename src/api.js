export async function request(url, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(!isForm && options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    body: options.body && !isForm && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  let data;
  try { data = await response.json(); } catch { const error=new Error(response.status===404?'The requested content endpoint is missing on this deployment.':'The server returned an unexpected response. Please try again.');error.status=response.status;throw error; }
  if (!response.ok) { const message=typeof data?.error==='string'?data.error:data?.error?.message||data?.message||'Something went wrong.'; const error = new Error(message); error.status = response.status; throw error; }
  return data;
}
export function initials(name) { return name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
