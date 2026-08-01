"use client"

import { Loader2 } from "lucide-react"
import {
  createContext,
  type ButtonHTMLAttributes,
  type FormHTMLAttributes,
  type ReactNode,
  useActionState,
  useContext,
  useEffect,
  useId,
  useState
} from "react"

import { showInternalToast } from "@/components/internal/InternalActionToaster"
import type { ManualPaymentActionState } from "./actions"

type ManagedServerAction = (
  previousState: ManualPaymentActionState,
  formData: FormData
) => Promise<ManualPaymentActionState>

type SubmissionContextValue = {
  activeButtonId: string | null
  pending: boolean
  setActiveButtonId: (id: string) => void
}

const initialState: ManualPaymentActionState = {
  status: "idle",
  title: "",
  message: "",
  submittedAt: 0
}

const SubmissionContext = createContext<SubmissionContextValue | null>(null)

export function ManagedActionForm({
  action,
  children,
  onSubmitCapture,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: ManagedServerAction
  children: ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null)

  useEffect(() => {
    if (pending) return
    setActiveButtonId(null)
  }, [pending])

  useEffect(() => {
    if (state.status === "idle") return
    showInternalToast({
      type: state.status,
      title: state.title,
      message: state.message
    })
  }, [state.message, state.status, state.submittedAt, state.title])

  return (
    <SubmissionContext.Provider value={{ activeButtonId, pending, setActiveButtonId }}>
      <form
        {...props}
        action={formAction}
        data-toast-managed="true"
        onSubmitCapture={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter
          const buttonId = submitter instanceof HTMLElement
            ? submitter.getAttribute("data-managed-submit-id")
            : null
          if (buttonId) setActiveButtonId(buttonId)
          onSubmitCapture?.(event)
        }}
      >
        {children}
      </form>
    </SubmissionContext.Provider>
  )
}

export function ManagedSubmitButton({
  children,
  pendingLabel,
  onClick,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel: string
}) {
  const context = useContext(SubmissionContext)
  const buttonId = useId()
  if (!context) throw new Error("ManagedSubmitButton must be used inside ManagedActionForm.")

  const isActive = context.pending && context.activeButtonId === buttonId

  return (
    <button
      {...props}
      type={props.type || "submit"}
      disabled={disabled || context.pending}
      aria-busy={isActive}
      data-managed-submit-id={buttonId}
      onClick={(event) => {
        context.setActiveButtonId(buttonId)
        onClick?.(event)
      }}
    >
      {isActive ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
      {isActive ? pendingLabel : children}
    </button>
  )
}
