"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react"
import { usePathname } from "next/navigation"

export type StudentIdentityAccount = {
  accountUuid: string
  fullName: string
  email: string
  profilePictureUrl: string
  domainsAutoRenewEnabled: boolean
  certificateNameConfirmedAt: string | null
  certificateNameUpdatedAt: string | null
  certificateNameNeedsConfirmation: boolean
}

type StudentAuthContextValue = {
  account: StudentIdentityAccount | null
  confirmedProfilePictureUrl: string | null
  mounted: boolean
  refreshAccount: () => Promise<boolean>
  updateAccount: (account: Partial<StudentIdentityAccount>) => void
}

type StudentAuthRefreshDetail = {
  account?: Partial<StudentIdentityAccount>
}

export const STUDENT_AUTH_REFRESH_EVENT = "student-auth-refresh"

const StudentAuthContext = createContext<StudentAuthContextValue | null>(null)

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [account, setAccount] = useState<StudentIdentityAccount | null>(null)
  const [confirmedProfilePictureUrl, setConfirmedProfilePictureUrl] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const expectedProfilePictureUrl = useRef<string | undefined>(undefined)

  const refreshAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/student/session", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok || !result.account) return false

      const refreshed = result.account as StudentIdentityAccount
      const refreshedUrl = String(refreshed.profilePictureUrl || "").trim()
      if (
        expectedProfilePictureUrl.current !== undefined &&
        refreshedUrl !== expectedProfilePictureUrl.current
      ) {
        // Ignore an older session response while an upload/removal is propagating.
        return false
      }

      expectedProfilePictureUrl.current = undefined
      setAccount({ ...refreshed, profilePictureUrl: refreshedUrl })
      setConfirmedProfilePictureUrl(refreshedUrl)
      return true
    } catch {
      // A temporary session refresh failure must not discard confirmed identity data.
      return false
    }
  }, [])

  const updateAccount = useCallback((update: Partial<StudentIdentityAccount>) => {
    if (Object.prototype.hasOwnProperty.call(update, "profilePictureUrl")) {
      const profilePictureUrl = String(update.profilePictureUrl || "").trim()
      expectedProfilePictureUrl.current = profilePictureUrl
      setConfirmedProfilePictureUrl(profilePictureUrl)
      update = { ...update, profilePictureUrl }
    }
    setAccount((current) => (current ? { ...current, ...update } : current))
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!pathname.startsWith("/dashboard") || pathname.startsWith("/dashboard/login")) return
    void refreshAccount()
  }, [pathname, refreshAccount])

  useEffect(() => {
    function handleRefresh(event: Event) {
      const detail = (event as CustomEvent<StudentAuthRefreshDetail>).detail
      if (detail?.account) updateAccount(detail.account)
      void refreshAccount()
    }

    window.addEventListener(STUDENT_AUTH_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(STUDENT_AUTH_REFRESH_EVENT, handleRefresh)
  }, [refreshAccount, updateAccount])

  const value = useMemo(
    () => ({ account, confirmedProfilePictureUrl, mounted, refreshAccount, updateAccount }),
    [account, confirmedProfilePictureUrl, mounted, refreshAccount, updateAccount]
  )

  return <StudentAuthContext.Provider value={value}>{children}</StudentAuthContext.Provider>
}

export function useStudentAuth() {
  const context = useContext(StudentAuthContext)
  if (!context) throw new Error("useStudentAuth must be used within a StudentAuthProvider")
  return context
}

export function refreshStudentIdentity(account?: Partial<StudentIdentityAccount>) {
  window.dispatchEvent(new CustomEvent<StudentAuthRefreshDetail>(STUDENT_AUTH_REFRESH_EVENT, {
    detail: account ? { account } : undefined
  }))
}
