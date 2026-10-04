import SwiftUI

struct HistorySheet: View {
    @Environment(ChatViewModel.self) private var chat
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if chat.conversations.isEmpty {
                    ContentUnavailableView {
                        Label("No conversations yet", systemImage: "flame")
                    } description: {
                        Text("Your walks with Emmaus will appear here.")
                    }
                    .foregroundStyle(Theme.mist)
                } else {
                    List {
                        ForEach(chat.conversations) { conversation in
                            Button {
                                chat.open(conversation)
                                dismiss()
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(conversation.title)
                                        .font(.serif(.body, weight: .medium))
                                        .foregroundStyle(Theme.parchment)
                                        .lineLimit(2)
                                    Text(conversation.updatedAt.formatted(.relative(presentation: .named)))
                                        .font(.caption)
                                        .foregroundStyle(Theme.faint)
                                }
                                .padding(.vertical, 4)
                            }
                            .listRowBackground(
                                conversation.id == chat.currentID ? Theme.gold.opacity(0.1) : Theme.surface.opacity(0.6)
                            )
                            .swipeActions {
                                Button("Delete", systemImage: "trash", role: .destructive) {
                                    withAnimation { chat.delete(conversation) }
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Conversations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .tint(Theme.gold)
                }
            }
        }
    }
}
