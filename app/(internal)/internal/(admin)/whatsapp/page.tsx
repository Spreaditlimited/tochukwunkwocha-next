import { WhatsAppContactsClient } from "./WhatsAppContactsClient"

export const dynamic = "force-dynamic"

export default function InternalWhatsAppPage() {
  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-2">
        <p className="eyebrow text-primary">Messaging</p>
        <h1 className="font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Admin WhatsApp
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Manage the WhatsApp contacts displayed on the public floating chat button. Add phone numbers in international format without the plus sign.
        </p>
      </div>

      <WhatsAppContactsClient />
    </main>
  )
}
