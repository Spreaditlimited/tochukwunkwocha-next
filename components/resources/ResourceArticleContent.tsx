type Block =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }

function parseResourceMarkdown(content: string) {
  const blocks: Block[] = []
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  let paragraph: string[] = []
  let listItems: string[] = []
  let orderedList = false

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() })
    paragraph = []
  }

  function flushList() {
    if (!listItems.length) return
    blocks.push({ type: "list", ordered: orderedList, items: listItems })
    listItems = []
    orderedList = false
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ type: "heading", level: heading[1].length as 2 | 3, text: heading[2].trim() })
      continue
    }

    const unordered = line.match(/^[-*]\s+(.+)$/)
    const ordered = line.match(/^\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      flushParagraph()
      const isOrdered = Boolean(ordered)
      if (listItems.length && orderedList !== isOrdered) flushList()
      orderedList = isOrdered
      listItems.push((ordered?.[1] || unordered?.[1] || "").trim())
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks
}

export function ResourceArticleContent({ content }: { content: string }) {
  const blocks = parseResourceMarkdown(content)

  return (
    <div className="blog-content">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level === 2) return <h2 key={`${block.text}-${index}`}>{block.text}</h2>
          return <h3 key={`${block.text}-${index}`}>{block.text}</h3>
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul"
          return (
            <ListTag key={`${block.items[0]}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ListTag>
          )
        }

        return <p key={`${block.text.slice(0, 40)}-${index}`}>{block.text}</p>
      })}
    </div>
  )
}
