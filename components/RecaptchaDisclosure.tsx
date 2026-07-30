export function RecaptchaDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-relaxed text-muted-foreground ${className}`.trim()}>
      This site is protected by reCAPTCHA and the Google{" "}
      <a
        className="underline underline-offset-2 hover:text-foreground"
        href="https://policies.google.com/privacy"
        rel="noreferrer"
        target="_blank"
      >
        Privacy Policy
      </a>{" "}
      and{" "}
      <a
        className="underline underline-offset-2 hover:text-foreground"
        href="https://policies.google.com/terms"
        rel="noreferrer"
        target="_blank"
      >
        Terms of Service
      </a>{" "}
      apply.
    </p>
  )
}
