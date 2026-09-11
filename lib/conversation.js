// src/client/conversation.ts
function appendToInput(input, inputActions, text) {
  try {
    if (!inputActions?.setDraft || !text) return false;
    const draft = input?.draft ?? "";
    inputActions.setDraft(draft.trim() ? `${draft} ${text}` : text);
    return true;
  } catch (error) {
    console.warn("[dsh-autodetect] \u6DFB\u52A0\u9009\u533A\u5230\u5BF9\u8BDD\u5931\u8D25:", error);
    return false;
  }
}
function appendToConversation(conversation, scope, text) {
  try {
    if (!conversation?.input || !scope || !text) return false;
    const input = conversation.input.for(scope);
    const draft = input.state.getSnapshot().draft ?? "";
    input.setDraft(draft.trim() ? `${draft} ${text}` : text);
    return true;
  } catch (error) {
    console.warn("[dsh-autodetect] \u6DFB\u52A0\u9009\u533A\u5230\u5BF9\u8BDD\u5931\u8D25:", error);
    return false;
  }
}
export {
  appendToConversation,
  appendToInput
};
