/** Play a notification sound from public/sounds/. */
export function playAudio(filename: string) {
  const audio = new Audio(`sounds/${filename}`);
  audio.play().catch((e) => console.error("Audio play failed:", e));
}
