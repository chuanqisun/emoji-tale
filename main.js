import "webcomponent-qr-code";
import { getSha256 } from "./crypto";
import { emojiList } from "./emojis.js";
import { getChatResponse } from "./openai";
import { playNothing, synthesizeSpeech } from "./speech";
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
  // reveal the story
  document.querySelectorAll("[data-text]").forEach((hiddenText) => (hiddenText.textContent = hiddenText.getAttribute("data-text")));

  // HACK, use an empty sound to wake up the hardware.
  playNothing();

  const passcode = await passcodeAsync;

  const thread = getThread();
  const response = await getChatResponse(
    passcode,
    "gpt-4o-mini",
    [
      {
        role: "system",
        content:
          "Connect the scenes together into a coherent Halloween themed ghost story in one paragraph. Try to keep the scenes intact, no matter how ridiculous they are, and tell the story in your natural voice",
      },
      {
        role: "user",
        content: thread.map((item) => item.text).join(" "),
      },
    ],
    {
      max_tokens: 4_000,
      temperature: 0.75,
    }
  );

  synthesizeSpeech(passcode, response.choices[0].message.content ?? "I'm sorry, I have encountered an error. Trick or treat!");
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
  const thread = getThread();

  const storyFile = new File([JSON.stringify(thread)], "story.json", { type: "application/json" });
  const magnetURI = await seed(storyFile);
  const appURL = new URL(location.href);
  appURL.searchParams.set("thread", magnetURI);

  shareContainer.innerHTML = `
  <qr-code format="svg" modulesize="4" data="${appURL.href}"></qr-code>
  <a href="${appURL.href}">Continue with URL</a>
  `;
}

function getThread() {
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

  return thread;
}
