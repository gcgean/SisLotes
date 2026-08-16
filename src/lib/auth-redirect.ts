export function sanitizeAuthRedirect(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
