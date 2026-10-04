import Foundation

extension String {
    /// Inline Markdown (bold, italics, links) with preserved line breaks.
    var inlineMarkdown: AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        return (try? AttributedString(markdown: self, options: options)) ?? AttributedString(self)
    }

    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
