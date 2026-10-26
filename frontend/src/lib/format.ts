import type { Business } from '../contracts';

export function businessKey(business: Business): string {
  const text = (value: string | null) =>
    normalized(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  return JSON.stringify(
    business.source_id
      ? [business.source, business.source_id]
      : [
          business.source,
          text(business.name),
          text(business.location.city),
          business.location.state,
          text(business.location.address),
        ],
  );
}
export function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('pt-BR');
}
export function formatDate(value: string | null): string {
  if (!value) return 'Ainda não realizada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}
export function localDateTime(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}
export function cleanWebUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Informe uma URL HTTP ou HTTPS sem usuário ou senha.');
  }
  return url.href;
}
