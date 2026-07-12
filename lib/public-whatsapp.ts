import { listAdminWhatsAppContacts } from "@/lib/admin-whatsapp"

export type PublicWhatsAppContact = {
  id: string
  label: string
  description?: string
  phone?: string
  messageId?: string
  defaultMessage?: string
}

export async function getPublicWhatsAppContacts(): Promise<PublicWhatsAppContact[]> {
  const managedContacts = await listAdminWhatsAppContacts(false).catch(() => [])
  return managedContacts
    .filter((contact) => contact.phone || contact.messageId)
    .map((contact) => ({
      id: contact.pidContact,
      label: contact.label,
      description: contact.description || undefined,
      phone: contact.phone || undefined,
      messageId: contact.messageId || undefined,
      defaultMessage: contact.defaultMessage || undefined
    }))
}
