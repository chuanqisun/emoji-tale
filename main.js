import { concatMap } from "rxjs";
import "webcomponent-qr-code";
import { getSha256 } from "./crypto";
import { emojiList } from "./emojis.js";
import { getChatStream } from "./openai";
import { createSentenceQueue, playNothing, synthesizeSpeech } from "./speech";
import { download, seed } from "./torrent.js";

const passcodeAsync = getSha256(new URLSearchParams(location.search).get("invite") ?? "");

const continueButton = document.querySelector("#continue");
const finishButton = document.querySelector("#finish");
const newMessageCard = document.querySelector("[data-new-message]");
const shareContainer = document.querySelector("#share-container");
const emojiInput = document.querySelector("#emoji");
const promptInput = document.querySelector("#prompt");
const messageTemplate = document.querySelector("#message-template");
const buttonGroup = document.querySelector(".button-group");

initThread();

continueButton.addEventListener("click", startSeed);

finishButton.addEventListener("click", async () => {
  // HACK, use an empty sound to wake up the hardware.
  playNothing();

  const passcode = await passcodeAsync;

  const { sentenceQueue, enqueue, flush } = createSentenceQueue();
  const stream = getChatStream(passcode, "gpt-4o-mini", [
    {
      role: "user",
      content: "Hello!",
    },
  ]);

  sentenceQueue.pipe(concatMap((sentence) => synthesizeSpeech(passcode, sentence))).subscribe();

  for await (const message of stream) {
    const delta = message.choices.at(0)?.delta.content ?? "";
    if (delta) enqueue(delta);
  }
  flush();
});

async function initThread() {
  const thread = new URLSearchParams(location.search).get("thread");
  if (thread) {
    const messages = JSON.parse(await download(thread, "story.json"));

    const items = messages.map((message) => {
      const cloned = messageTemplate.content.cloneNode(true);
      cloned.querySelector(".message-card").setAttribute("data-previous-item", "");
      cloned.querySelector("[data-emoji]").textContent = message.emoji;
      cloned.querySelector("[data-text]").textContent = message.text.replace(/./g, "*");
      cloned.querySelector("[data-text]").setAttribute("data-text", message.text);

      return cloned;
    });

    document.querySelector(".thread").prepend(...items);
  }

  const usedEmojis = new Set([...document.querySelectorAll("[data-emoji]")].map((emoji) => emoji.textContent.trim()));
  const unusedEmojis = emojiList.filter((emoji) => !usedEmojis.has(emoji));
  if (unusedEmojis.length) {
    emojiInput.textContent = unusedEmojis[Math.floor(Math.random() * unusedEmojis.length)];
  } else {
    continueButton.remove();
    finishButton.classList.remove("secondary");
    newMessageCard.remove();
  }

  newMessageCard.removeAttribute("hidden");
  buttonGroup.removeAttribute("hidden");
}

async function startSeed() {
  const thread = [
    ...[...document.querySelectorAll("[data-previous-item]")].map((card) => ({
      emoji: card.querySelector("[data-emoji]").textContent,
      text: card.querySelector("[data-text]").getAttribute("data-text"),
    })),
    {
      emoji: emojiInput.textContent,
      text: promptInput.value,
    },
  ];

  const storyFile = new File([JSON.stringify(thread)], "story.json", { type: "application/json" });
  const magnetURI = await seed(storyFile);
  const appURL = new URL(location.href);
  appURL.searchParams.set("thread", magnetURI);

  shareContainer.innerHTML = `
  <qr-code format="svg" modulesize="4" data="${appURL.href}"></qr-code>
  <a href="${appURL.href}">Continue with URL</a>
  `;
}
