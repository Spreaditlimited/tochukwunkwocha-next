import type { ReactNode } from "react"

const mark = "Prompt to Profit"

export function TrademarkText({ text }: { text: string }) {
  const parts = text.split(mark)

  if (parts.length === 1) {
    return <>{text}</>
  }

  return (
    <>
      {parts.map((part, index) => (
        <FragmentWithMark key={`${part}-${index}`} part={part} showMark={index < parts.length - 1} />
      ))}
    </>
  )
}

function FragmentWithMark({ part, showMark }: { part: string; showMark: boolean }) {
  return (
    <>
      {part}
      {showMark ? <PromptToProfitMark /> : null}
    </>
  )
}

export function PromptToProfitMark({ suffix }: { suffix?: ReactNode }) {
  return (
    <>
      Prompt to Profit<sup className="ml-0.5 align-super text-[0.55em] leading-none">™</sup>
      {suffix}
    </>
  )
}
