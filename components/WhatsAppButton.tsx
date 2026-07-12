"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"

import type { PublicWhatsAppContact } from "@/lib/public-whatsapp"

type WhatsAppButtonProps = {
  waID?: string
  contacts?: PublicWhatsAppContact[]
  message?: string
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" fill="currentColor">
      <path d="M16.01 3.2A12.67 12.67 0 0 0 5.02 22.2L3.2 28.8l6.78-1.78A12.65 12.65 0 1 0 16.01 3.2Zm0 2.25a10.4 10.4 0 1 1-5.3 19.35l-.38-.23-4.03 1.06 1.08-3.92-.25-.4A10.4 10.4 0 0 1 16.01 5.45Zm-4.36 5.72c-.24 0-.62.09-.95.45-.32.36-1.25 1.22-1.25 2.98s1.28 3.46 1.46 3.7c.18.24 2.47 3.95 6.1 5.38 3.02 1.18 3.63.95 4.28.89.65-.06 2.1-.86 2.4-1.69.3-.83.3-1.54.21-1.69-.09-.15-.33-.24-.69-.42-.36-.18-2.1-1.04-2.43-1.16-.33-.12-.57-.18-.81.18-.24.36-.93 1.16-1.14 1.4-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.9-1.79-1.07-.96-1.8-2.14-2.01-2.5-.21-.36-.02-.56.16-.74.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.81-1.95-1.11-2.67-.29-.7-.59-.6-.81-.61h-.69Z" />
    </svg>
  )
}

function positionClass(position: NonNullable<WhatsAppButtonProps["position"]>) {
  switch (position) {
    case "top-left":
      return "left-4 top-4"
    case "top-right":
      return "right-4 top-4"
    case "bottom-left":
      return "bottom-4 left-4"
    case "bottom-right":
    default:
      return "bottom-4 right-4"
  }
}

function panelPositionClass(position: NonNullable<WhatsAppButtonProps["position"]>) {
  return position.endsWith("left") ? "left-0" : "right-0"
}

function panelVerticalClass(position: NonNullable<WhatsAppButtonProps["position"]>) {
  return position.startsWith("top") ? "top-20" : "bottom-20"
}

function buildWhatsAppUrl(contact: PublicWhatsAppContact, message: string) {
  const text = contact.defaultMessage || message
  if (contact.phone) {
    const phone = contact.phone.replace(/\D/g, "")
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
  }
  if (contact.messageId) {
    return `https://wa.me/message/${contact.messageId}?text=${encodeURIComponent(text)}`
  }
  return "#"
}

export function WhatsAppButton({
  waID = "",
  contacts,
  message = "Hello! I have a question from the Tochukwu Tech website.",
  position = "bottom-left"
}: WhatsAppButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [managedContacts, setManagedContacts] = useState<PublicWhatsAppContact[] | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchManagedContacts = async () => {
      try {
        const response = await fetch("/api/admin-whatsapp", { cache: "no-store" })
        const data = await response.json()
        if (!response.ok || !Array.isArray(data?.data)) return
        if (isMounted) setManagedContacts(data.data)
      } catch {
        if (isMounted) setManagedContacts(null)
      }
    }

    fetchManagedContacts()

    return () => {
      isMounted = false
    }
  }, [])

  const configuredContacts = useMemo(() => {
    const source = contacts?.length ? contacts : managedContacts?.length ? managedContacts : []

    if (source.length > 0) {
      return source.filter((contact) => contact.phone || contact.messageId)
    }

    if (!waID) return []

    return [
      {
        id: "default",
        label: "WhatsApp",
        description: "Chat with Tochukwu Tech",
        messageId: waID
      }
    ]
  }, [contacts, managedContacts, waID])

  if (!configuredContacts.length) return null

  const closeWithDelay = () => {
    closeTimeoutRef.current = setTimeout(() => setIsOpen(false), 120)
  }

  const cancelClose = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
  }

  return (
    <div
      className={`fixed ${positionClass(position)} z-20`}
      onMouseEnter={cancelClose}
      onMouseLeave={closeWithDelay}
    >
      {isOpen ? (
        <div className={`absolute ${panelVerticalClass(position)} ${panelPositionClass(position)} w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-800 dark:bg-slate-950`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Chat on WhatsApp</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose the right team</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close WhatsApp contacts"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto p-2">
            {configuredContacts.map((contact) => (
              <a
                key={contact.id}
                href={buildWhatsAppUrl(contact, message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left no-underline transition hover:bg-green-50 dark:hover:bg-green-950/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                  <WhatsAppIcon className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">{contact.label}</span>
                  {contact.description ? (
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{contact.description}</span>
                  ) : null}
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-900/20 transition hover:bg-green-600"
        aria-expanded={isOpen}
        aria-label="Contact us on WhatsApp"
        title="Contact us on WhatsApp"
      >
        <span className="relative flex items-center">
          <WhatsAppIcon className="h-8 w-8" />
          <ChevronDown
            size={14}
            className={`absolute -bottom-2 -right-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>
    </div>
  )
}
