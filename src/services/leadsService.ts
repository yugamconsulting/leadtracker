export function prependLead<T>(leads: T[], lead: T): T[] {
  return [lead, ...leads];
}

export function patchLeadById<T extends { id: string }>(
  leads: T[],
  leadId: string,
  updater: (lead: T) => T,
): T[] {
  return leads.map((lead) => (lead.id === leadId ? updater(lead) : lead));
}

export function patchLeadsByIds<T extends { id: string }>(
  leads: T[],
  leadIds: string[],
  updater: (lead: T) => T,
): T[] {
  const ids = new Set(leadIds);
  return leads.map((lead) => (ids.has(lead.id) ? updater(lead) : lead));
}
