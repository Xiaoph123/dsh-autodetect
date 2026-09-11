export type ConversationInputScope = object

export interface ConversationService {
  input?: {
    for(scope: ConversationInputScope): {
      state: { getSnapshot(): { draft?: string } }
      setDraft(text: string): void
    }
  }
}

export interface InputActions {
  setDraft?(text: string): void
}

export interface InputState {
  draft?: string
}

export function appendToInput(
  input: InputState | undefined,
  inputActions: InputActions | undefined,
  text: string,
): boolean {
  try {
    if (!inputActions?.setDraft || !text) return false
    const draft = input?.draft ?? ''
    inputActions.setDraft(draft.trim() ? `${draft} ${text}` : text)
    return true
  } catch (error) {
    console.warn('[dsh-autodetect] 添加选区到对话失败:', error)
    return false
  }
}

/** Append text through the official per-session conversation input facade. */
export function appendToConversation(
  conversation: ConversationService | undefined,
  scope: ConversationInputScope | undefined,
  text: string,
): boolean {
  try {
    if (!conversation?.input || !scope || !text) return false
    const input = conversation.input.for(scope)
    const draft = input.state.getSnapshot().draft ?? ''
    input.setDraft(draft.trim() ? `${draft} ${text}` : text)
    return true
  } catch (error) {
    console.warn('[dsh-autodetect] 添加选区到对话失败:', error)
    return false
  }
}
