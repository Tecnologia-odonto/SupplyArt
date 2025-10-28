export function getPasswordResetUrl(): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/reset-password`;
}

export function getBaseUrl(): string {
  return window.location.origin;
}

export function getFullUrl(path: string): string {
  const baseUrl = getBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
