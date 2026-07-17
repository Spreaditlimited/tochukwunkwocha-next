"use client"

import Image from "next/image"

import { useStudentAuth } from "@/components/student-dashboard/StudentAuthContext"
import { resolveMediaUrl } from "@/lib/cloudinary/url"

type StudentSidebarAvatarProps = {
  fullName: string
  initialUrl: string
}

export function StudentSidebarAvatar({ fullName, initialUrl }: StudentSidebarAvatarProps) {
  const { account, confirmedProfilePictureUrl, mounted } = useStudentAuth()
  const currentName = account?.fullName || fullName
  const profilePictureUrl = resolveMediaUrl(
    confirmedProfilePictureUrl ?? account?.profilePictureUrl ?? initialUrl
  )

  if (!mounted) return <span className="block h-9 w-9" aria-hidden="true" />

  return profilePictureUrl ? (
    <Image
      src={profilePictureUrl}
      alt={`${currentName}'s profile picture`}
      width={36}
      height={36}
      unoptimized
      className="h-full w-full object-cover"
    />
  ) : (
    <span aria-label={`${currentName} has no profile picture`}>{currentName.charAt(0).toUpperCase()}</span>
  )
}
