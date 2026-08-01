"use client"

import { Loader2, Mail } from "lucide-react"
import { useActionState, useEffect } from "react"

import { showInternalToast } from "@/components/internal/InternalActionToaster"
import {
  resendManualPaymentActivationEmailAction,
  type ActivationEmailActionState
} from "./actions"

const initialState: ActivationEmailActionState = {
  status: "idle",
  title: "",
  message: "",
  submittedAt: 0
}

export function ActivationEmailForm({
  paymentUuid,
  source,
  accountExists = true
}: {
  paymentUuid: string
  source: "manual" | "online"
  accountExists?: boolean
}) {
  const [state, action, pending] = useActionState(
    resendManualPaymentActivationEmailAction,
    initialState
  )

  useEffect(() => {
    if (state.status === "idle") return
    showInternalToast({
      type: state.status,
      title: state.title,
      message: state.message
    })
  }, [state.message, state.status, state.submittedAt, state.title])

  const idleLabel = accountExists ? "Resend Activation" : "Provision & Send Activation"

  return (
    <form action={action} data-toast-managed="true">
      <input type="hidden" name="paymentUuid" value={paymentUuid} />
      <input type="hidden" name="source" value={source} />
      <button
        className="btn-secondary w-full justify-center py-2 text-xs shadow-sm"
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />}
        {pending ? "Sending..." : idleLabel}
      </button>
    </form>
  )
}
