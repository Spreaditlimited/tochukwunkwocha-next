"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Camera, Laptop, Loader2, LockKeyhole, Smartphone, Trash2, UserRound } from "lucide-react"

import { PasswordField } from "@/components/PasswordField"
import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import { refreshStudentIdentity } from "@/components/student-dashboard/StudentAuthContext"
import { resolveMediaUrl } from "@/lib/cloudinary/url"

type Profile = {
  fullName: string
  email: string
  profilePictureUrl: string
  phone: string
  whatsappOptedIn: boolean
  certificateNameConfirmedAt: Date | string | null
  certificateNameUpdatedAt: Date | string | null
  demographicCountry: string
  demographicRegion: string
  ageBand: string
  gender: string
  learnerCategory: string
  demographicUpdatedAt: Date | string | null
}

type SecurityPayload = {
  sessions: Array<{
    sessionUuid: string
    deviceIdHint: string | null
    userAgent: string | null
    createdAt: Date | string
    lastSeenAt: Date | string | null
    expiresAt: Date | string
    isCurrent: boolean
  }>
  devices: Array<{
    id: bigint | number
    deviceIdHint: string | null
    lastUserAgent: string | null
    firstSeenAt: Date | string
    lastSeenAt: Date | string
  }>
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Request failed")
  return payload as T
}

function formatDate(value: Date | string | null) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Not recorded"
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ""
  return `${Number(part("day"))} ${part("month")} ${part("year")} at ${part("hour")}:${part("minute")}`
}

export function ProfileSecurityPanel({ profile: initialProfile, security }: { profile: Profile; security: SecurityPayload }) {
  const router = useRouter()
  const profilePictureInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState(initialProfile)
  
  // State for messages
  const [profileMessage, setProfileMessage] = useState("")
  const [profileError, setProfileError] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [securityError, setSecurityError] = useState("")
  const [profilePictureError, setProfilePictureError] = useState("")

  // Loading states
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isUpdatingProfilePicture, setIsUpdatingProfilePicture] = useState(false)
  const ageBandOptions = [
    { value: "", label: "Select age band" },
    { value: "under-13", label: "Under 13" },
    { value: "13-17", label: "13-17" },
    { value: "18-24", label: "18-24" },
    { value: "25-34", label: "25-34" },
    { value: "35-44", label: "35-44" },
    { value: "45-plus", label: "45+" }
  ]
  const genderOptions = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" }
  ]
  const learnerCategoryOptions = [
    { value: "", label: "Select learner category" },
    { value: "child-learner", label: "Child learner" },
    { value: "secondary-school-student", label: "Secondary school student" },
    { value: "higher-education-student", label: "Higher education student" },
    { value: "job-seeker", label: "Job seeker" },
    { value: "working-professional", label: "Working professional" },
    { value: "business-owner", label: "Business owner" },
    { value: "teacher-educator", label: "Teacher / educator" },
    { value: "parent-guardian", label: "Parent / guardian" }
  ]

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingProfile(true)
    setProfileError("")
    setProfileMessage("")
    try {
      const result = await postJson<{ profile: Profile }>("/api/student/profile", profile)
      setProfile(result.profile)
      setProfileMessage("Profile updated successfully.")
      showStudentToast({ type: "success", title: "Profile updated", message: "Your profile details have been saved." })
      router.refresh()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not update profile"
      setProfileError(errorMessage)
      showStudentToast({ type: "error", title: "Profile update failed", message: errorMessage })
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function uploadProfilePicture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setProfilePictureError("")
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setProfilePictureError("Upload a JPG, PNG, or WebP image.")
      return
    }
    if (file.size <= 0 || file.size > 1024 * 1024) {
      setProfilePictureError("Profile picture must be 1 MB or smaller.")
      return
    }

    setIsUpdatingProfilePicture(true)
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch("/api/student/profile-picture", { method: "POST", body })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok || !result?.profilePictureUrl) {
        throw new Error(result?.error || "Could not upload the profile picture.")
      }
      setProfile((current) => ({ ...current, profilePictureUrl: String(result.profilePictureUrl) }))
      refreshStudentIdentity({ profilePictureUrl: String(result.profilePictureUrl) })
      showStudentToast({ type: "success", title: "Profile picture updated", message: "Your new profile picture has been saved." })
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not upload the profile picture."
      setProfilePictureError(message)
      showStudentToast({ type: "error", title: "Upload failed", message })
    } finally {
      setIsUpdatingProfilePicture(false)
    }
  }

  async function removeProfilePicture() {
    setProfilePictureError("")
    setIsUpdatingProfilePicture(true)
    try {
      const response = await fetch("/api/student/profile-picture", { method: "DELETE" })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not remove the profile picture.")
      setProfile((current) => ({ ...current, profilePictureUrl: "" }))
      refreshStudentIdentity({ profilePictureUrl: "" })
      showStudentToast({ type: "success", title: "Profile picture removed", message: "Your profile picture has been removed." })
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove the profile picture."
      setProfilePictureError(message)
      showStudentToast({ type: "error", title: "Removal failed", message })
    } finally {
      setIsUpdatingProfilePicture(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsChangingPassword(true)
    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get("newPassword") || "")
    const confirmPassword = String(form.get("confirmPassword") || "")
    setPasswordError("")
    setPasswordMessage("")
    try {
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match")
      const result = await postJson<{ message: string }>("/api/student/password", {
        currentPassword: String(form.get("currentPassword") || ""),
        newPassword
      })
      event.currentTarget.reset()
      setPasswordMessage(result.message)
      showStudentToast({ type: "success", title: "Password changed", message: result.message })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not change password"
      setPasswordError(errorMessage)
      showStudentToast({ type: "error", title: "Password change failed", message: errorMessage })
    } finally {
      setIsChangingPassword(false)
    }
  }

  async function revokeSession(sessionUuid?: string) {
    setSecurityError("")
    try {
      await postJson("/api/student/security/session", sessionUuid ? { sessionUuid } : { action: "revoke_others" })
      showStudentToast({ type: "success", title: "Session security updated", message: sessionUuid ? "The selected session has been revoked." : "Other active sessions have been revoked." })
      router.refresh()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not update sessions"
      setSecurityError(errorMessage)
      showStudentToast({ type: "error", title: "Session update failed", message: errorMessage })
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_1fr] lg:items-start">
      
      {/* LEFT COLUMN: Profile */}
      <div className="grid gap-8">
        <section className="surface-raised bg-card p-0 overflow-hidden">
          <div className="flex items-center gap-4 border-b border-border bg-muted/20 p-6 sm:p-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <p className="eyebrow text-primary">Account Profile</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Personal Details</h2>
            </div>
          </div>
          
          <div className="p-6 sm:p-8">
            <form onSubmit={saveProfile} className="grid gap-6">
              <div className="flex flex-col gap-5 rounded-xl border border-border bg-muted/20 p-5 sm:flex-row sm:items-center">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-primary/10 text-primary shadow-sm">
                  {profile.profilePictureUrl ? (
                    <Image
                      src={resolveMediaUrl(profile.profilePictureUrl)}
                      alt={`${profile.fullName}'s profile picture`}
                      width={112}
                      height={112}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound className="h-12 w-12" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-base font-bold text-foreground">Profile picture</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Upload a square JPG, PNG, or WebP image. Maximum file size: 1 MB.
                  </p>
                  <input
                    ref={profilePictureInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={uploadProfilePicture}
                    disabled={isUpdatingProfilePicture}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2 text-xs"
                      onClick={() => profilePictureInputRef.current?.click()}
                      disabled={isUpdatingProfilePicture}
                    >
                      {isUpdatingProfilePicture ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                      {profile.profilePictureUrl ? "Change picture" : "Upload picture"}
                    </button>
                    {profile.profilePictureUrl ? (
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2 text-xs text-destructive hover:border-destructive/30 hover:bg-destructive/10"
                        onClick={removeProfilePicture}
                        disabled={isUpdatingProfilePicture}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </button>
                    ) : null}
                  </div>
                  {profilePictureError ? (
                    <p className="mt-3 text-xs font-semibold text-destructive" role="alert">{profilePictureError}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</span>
                  <input
                    className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    value={profile.fullName}
                    onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Address</span>
                  <input
                    className="w-full cursor-not-allowed rounded-md border border-input bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground outline-none"
                    value={profile.email}
                    readOnly
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">WhatsApp / Phone</span>
                  <input
                    className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    value={profile.phone}
                    onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+234..."
                  />
                </label>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-5">
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Learner Profile</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    The information below helps us understand our learner community, improve our programmes, and measure our impact across different demographics.
                  </p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Country</span>
                    <input
                      className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                      value={profile.demographicCountry}
                      onChange={(event) => setProfile((current) => ({ ...current, demographicCountry: event.target.value }))}
                      placeholder="Nigeria"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">State / Region</span>
                    <input
                      className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                      value={profile.demographicRegion}
                      onChange={(event) => setProfile((current) => ({ ...current, demographicRegion: event.target.value }))}
                      placeholder="Lagos"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Age Band</span>
                    <PremiumPicker
                      value={profile.ageBand}
                      options={ageBandOptions}
                      onChange={(event) => setProfile((current) => ({ ...current, ageBand: event.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gender</span>
                    <PremiumPicker
                      value={profile.gender}
                      options={genderOptions}
                      placeholder="Select gender"
                      required
                      onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value }))}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Learner Category</span>
                    <PremiumPicker
                      value={profile.learnerCategory}
                      options={learnerCategoryOptions}
                      onChange={(event) => setProfile((current) => ({ ...current, learnerCategory: event.target.value }))}
                    />
                  </label>
                </div>
              </div>

              {/* WhatsApp Toggle */}
              <label className="group relative flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20 hover:shadow-sm">
                <div>
                  <span className="block text-sm font-bold text-foreground">WhatsApp Notifications</span>
                  <span className="mt-1 block text-xs font-medium text-muted-foreground">Receive class reminders and updates</span>
                </div>
                <div className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors">
                  <input
                    type="checkbox"
                    checked={profile.whatsappOptedIn}
                    onChange={(event) => setProfile((current) => ({ ...current, whatsappOptedIn: event.target.checked }))}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/30"></div>
                  <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                </div>
              </label>

              {/* Certificate Identity Info */}
              <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Certificate Identity</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {profile.certificateNameConfirmedAt ? `Confirmed ${formatDate(profile.certificateNameConfirmedAt)}` : "Not confirmed"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${profile.certificateNameConfirmedAt ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {profile.certificateNameConfirmedAt ? "Verified" : "Pending"}
                  </span>
                  {!profile.certificateNameConfirmedAt ? (
                    <Link href="/dashboard/certificate" className="btn-primary px-3 py-2 text-xs">
                      Confirm Now
                    </Link>
                  ) : null}
                </div>
              </div>

              {/* Form Feedback */}
              {profileError ? <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">{profileError}</p> : null}
              {profileMessage ? <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{profileMessage}</p> : null}
              
              <button className="btn-primary w-full shadow-sm sm:w-auto" type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: Security */}
      <div className="grid gap-8">
        
        {/* Change Password */}
        <section className="surface-raised bg-card p-0 overflow-hidden">
          <div className="flex items-center gap-4 border-b border-border bg-muted/20 p-6 sm:p-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <div>
              <p className="eyebrow text-primary">Authentication</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Change Password</h2>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <form onSubmit={changePassword} className="grid gap-5">
              <PasswordField
                inputClassName="w-full rounded-md border border-input bg-background px-4 py-3 pr-12 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                name="currentPassword" 
                placeholder="Current password" 
                required 
                autoComplete="current-password" 
              />
              <PasswordField
                inputClassName="w-full rounded-md border border-input bg-background px-4 py-3 pr-12 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                name="newPassword" 
                minLength={8} 
                placeholder="New password (min 8 characters)" 
                required 
                autoComplete="new-password" 
              />
              <PasswordField
                inputClassName="w-full rounded-md border border-input bg-background px-4 py-3 pr-12 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                name="confirmPassword" 
                minLength={8} 
                placeholder="Confirm new password" 
                required 
                autoComplete="new-password" 
              />
              
              {passwordError ? <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">{passwordError}</p> : null}
              {passwordMessage ? <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{passwordMessage}</p> : null}
              
              <button className="btn-secondary w-full sm:w-auto" type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </section>

        {/* Active Sessions */}
        <section className="surface-raised bg-card p-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="eyebrow text-primary">Access Control</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Active Sessions</h2>
            </div>
            <button 
              className="btn-secondary whitespace-nowrap text-xs" 
              type="button" 
              onClick={() => revokeSession()}
            >
              Sign out others
            </button>
          </div>
          
          <div className="p-6 sm:p-8">
            {securityError ? <p className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">{securityError}</p> : null}
            
            <div className="grid gap-3">
              {security.sessions.map((session) => {
                const isMobile = session.userAgent?.toLowerCase().includes("mobile")
                
                return (
                  <div key={session.sessionUuid} className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {isMobile ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-heading text-sm font-bold text-foreground">
                          {session.deviceIdHint || "Trusted Device"}
                          {session.isCurrent && (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">Current</span>
                          )}
                        </p>
                        <p className="mt-1 truncate text-xs font-medium text-muted-foreground max-w-[200px] sm:max-w-[250px]">
                          {session.userAgent || "Browser details unavailable"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last seen {formatDate(session.lastSeenAt)}
                        </p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button 
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive" 
                        type="button" 
                        onClick={() => revokeSession(session.sessionUuid)} 
                        aria-label="Revoke session"
                        title="Revoke session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
