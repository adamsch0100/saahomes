/** Open the globally mounted Nadia chat with an optional seeded visitor message. */
export function openNadiaChat(message = "") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("open-nadia-chat", {
      detail: { message: String(message || "").trim() },
    })
  );
}
