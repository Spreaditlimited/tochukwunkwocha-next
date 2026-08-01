"use client"

import { Loader2, UserPlus } from "lucide-react"
import { useActionState, useEffect } from "react"

import { showInternalToast } from "@/components/internal/InternalActionToaster"
import {
  provisionMissingPaidEnrollmentAccountsAction,
  type ProvisionMissingAccountsActionState
} from "./actions"

const initialState: ProvisionMissingAccountsActionState = {
  status: "idle",
  title: "",
  message: "",
  submittedAt: 0
}

export function ProvisionMissingAccountsForm() {
  const [state, action, pending] = useActionState(
    provisionMissingPaidEnrollmentAccountsAction,
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

  return (
    <form action={action} data-toast-managed="true">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        title="Checks paid enrollments for missing student accounts."
        className="btn-secondary w-full justify-center shadow-sm sm:w-auto"
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
        {pending ? "Creating account..." : "Provision Missing Accounts"}
      </button>
    </form>
  )
}
