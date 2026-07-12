"use client"

import { useEffect, useState } from "react"
import { MessageCircle, Plus, RefreshCw, Save, Trash2 } from "lucide-react"

import { showInternalToast } from "@/components/internal/InternalActionToaster"

type WhatsAppContact = {
  pidContact: string
  label: string
  description: string
  phone: string
  messageId: string
  defaultMessage: string
  isActive: boolean
}

function emptyContact(): WhatsAppContact {
  return {
    pidContact: `WAC-${Date.now()}`,
    label: "",
    description: "",
    phone: "",
    messageId: "",
    defaultMessage: "",
    isActive: true
  }
}

function cleanContact(row: Partial<WhatsAppContact>): WhatsAppContact {
  return {
    pidContact: String(row.pidContact || `WAC-${Date.now()}`),
    label: String(row.label || ""),
    description: String(row.description || ""),
    phone: String(row.phone || ""),
    messageId: String(row.messageId || ""),
    defaultMessage: String(row.defaultMessage || ""),
    isActive: row.isActive !== false
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function WhatsAppContactsClient() {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function fetchContacts() {
    setLoading(true)
    try {
      const response = await fetch("/api/internal/whatsapp", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || "Failed to load contacts.")
      const rows = Array.isArray(payload?.data) ? payload.data : []
      setContacts(rows.length ? rows.map(cleanContact) : [emptyContact()])
    } catch (error) {
      setContacts([emptyContact()])
      showInternalToast({
        type: "error",
        title: "WhatsApp contacts failed",
        message: getErrorMessage(error, "Failed to load contacts.")
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  function updateContact(index: number, field: keyof WhatsAppContact, value: string | boolean) {
    setContacts((current) => current.map((contact, itemIndex) => itemIndex === index ? { ...contact, [field]: value } : contact))
  }

  function removeContact(index: number) {
    setContacts((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index)
      return next.length ? next : [emptyContact()]
    })
  }

  async function saveContacts() {
    setSaving(true)
    showInternalToast({
      type: "loading",
      title: "Saving WhatsApp contacts",
      message: "Please wait while the contact list is updated."
    })
    try {
      const response = await fetch("/api/internal/whatsapp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || "Failed to save contacts.")
      const rows = Array.isArray(payload?.data) ? payload.data : []
      setContacts(rows.length ? rows.map(cleanContact) : [emptyContact()])
      showInternalToast({
        type: "success",
        title: "WhatsApp contacts updated",
        message: "The public floating WhatsApp button will use the active contacts."
      })
    } catch (error) {
      showInternalToast({
        type: "error",
        title: "WhatsApp contacts not saved",
        message: getErrorMessage(error, "Failed to save contacts.")
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">WhatsApp Contacts</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Add the contacts shown in the public floating WhatsApp button. Phone number is enough; message ID is optional.
              </p>
            </div>
          </div>
          {loading ? <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {contacts.map((contact, index) => (
            <article key={`${contact.pidContact}-${index}`} className="rounded-xl border border-border bg-background p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact {index + 1}</p>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={contact.isActive}
                      onChange={(event) => updateContact(index, "isActive", event.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => removeContact(index)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-destructive transition hover:bg-destructive/10"
                    aria-label="Remove WhatsApp contact"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Label</span>
                  <input
                    value={contact.label}
                    onChange={(event) => updateContact(index, "label", event.target.value)}
                    placeholder="General Enquiries"
                    className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number</span>
                  <input
                    value={contact.phone}
                    onChange={(event) => updateContact(index, "phone", event.target.value)}
                    placeholder="2348012345678"
                    className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</span>
                  <input
                    value={contact.description}
                    onChange={(event) => updateContact(index, "description", event.target.value)}
                    placeholder="Courses, schools, coaching, and build services"
                    className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">WhatsApp Message ID</span>
                  <input
                    value={contact.messageId}
                    onChange={(event) => updateContact(index, "messageId", event.target.value)}
                    placeholder="Optional wa.me/message ID"
                    className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Default Message</span>
                <textarea
                  value={contact.defaultMessage}
                  onChange={(event) => updateContact(index, "defaultMessage", event.target.value)}
                  rows={3}
                  placeholder="Leave empty to use the page-specific message."
                  className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </label>
            </article>
          ))}

          <button
            type="button"
            onClick={() => setContacts((current) => [...current, emptyContact()])}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-black text-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Add WhatsApp Contact
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || loading}
          onClick={saveContacts}
          className="btn-primary px-8 py-3 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save WhatsApp Contacts
        </button>
      </div>
    </section>
  )
}
