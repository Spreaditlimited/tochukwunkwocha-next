import AppKit
import PDFKit

guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: inspect_pdf.swift PDF [page-number] [output.png]\n", stderr)
    exit(2)
}

let pdfURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: pdfURL) else {
    fputs("Could not open PDF\n", stderr)
    exit(1)
}

print("pages\t\(document.pageCount)")

if CommandLine.arguments.count >= 4 {
    guard let requestedPage = Int(CommandLine.arguments[2]),
          requestedPage >= 1,
          requestedPage <= document.pageCount,
          let page = document.page(at: requestedPage - 1) else {
        fputs("Invalid page number\n", stderr)
        exit(2)
    }
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2.0
    let width = Int(bounds.width * scale)
    let height = Int(bounds.height * scale)
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        fputs("Could not create bitmap\n", stderr)
        exit(1)
    }
    NSGraphicsContext.saveGraphicsState()
    guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        fputs("Could not create graphics context\n", stderr)
        exit(1)
    }
    NSGraphicsContext.current = context
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()
    context.cgContext.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context.cgContext)
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        fputs("Could not encode PNG\n", stderr)
        exit(1)
    }
    try png.write(to: URL(fileURLWithPath: CommandLine.arguments[3]))
}

for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else { continue }
    let text = (page.string ?? "")
        .replacingOccurrences(of: "\n", with: " ")
        .replacingOccurrences(of: "\t", with: " ")
    let compact = text.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    let preview = String(compact.prefix(120))
    print("\(index + 1)\t\(compact.count)\t\(preview)")
}
