/** Camps comuns a tots els registres. Les dates són ISO 8601. */
export interface Registre {
  id: string
  creatAt: string
  modificatAt: string
}

export function nouId(): string {
  return crypto.randomUUID()
}

export function araIso(): string {
  return new Date().toISOString()
}
