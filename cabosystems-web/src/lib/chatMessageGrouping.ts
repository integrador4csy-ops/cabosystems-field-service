export function startsSenderGroup(messages: readonly { remitente_id: string }[], index: number): boolean {
  return index === 0 || messages[index - 1].remitente_id !== messages[index].remitente_id;
}
