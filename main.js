import "webcomponent-qr-code";
import { compressText, decompressText } from "./compression.js";
import { getSha256 } from "./crypto";
import { emojiList } from "./emojis.js";
import { getChatResponse } from "./openai";
import { synthesizeSpeech } from "./speech";
import soundtrackUrl from "/alex-productions-freaky-halloween.mp3?url";

const passcodeAsync = getSha256(new URLSearchParams(location.search).get("invite") ?? "");

const appName = document.querySelector("h1 a");
const continueButton = document.querySelector("#continue");
const finishButton = document.querySelector("#finish");
const newMessageCard = document.querySelector("[data-new-message]");
const shareContainer = document.querySelector("#share-container");
const emojiInput = document.querySelector("#emoji");
const promptInput = document.querySelector("#prompt");
const messageTemplate = document.querySelector("#message-template");
const buttonGroup = document.querySelector(".button-group");
const audio = document.querySelector("audio");
audio.src = soundtrackUrl;

initThread();

document.querySelector("body").addEventListener("click", playAudioOnce);

appName.addEventListener("click", resetGame);

continueButton.addEventListener("click", startSeed);

finishButton.addEventListener("click", async () => {
  // reveal the story
  document.querySelectorAll("[data-text]").forEach((hiddenText) => (hiddenText.textContent = hiddenText.getAttribute("data-text")));

  shareContainer.textContent = "Piecing together the scenes...";

  const passcode = await passcodeAsync;

  const thread = getThread();
  const response = await getChatResponse(
    passcode,
    "gpt-4o",
    [
      {
        role: "system",
        content: `Write a Halloween themed ghost poem based on provided scenes. One prose per secene. Keep the scene intact no matter how ridiculous they are, Read the poem in your poetic voice. No title.`,
      },
      {
        role: "user",
        content: thread
          .map((item, index) => `Scene${thread.length > 1 ? ` ${index + 1}` : ""}: ${item.text.trim().length ? item.text : item.emoji}`)
          .join("\n"),
      },
    ],
    {
      max_tokens: 4_000,
      temperature: 0.75,
    }
  );

  fadeoutAudio(0.05);

  shareContainer.textContent = response.choices[0].message.content;
  synthesizeSpeech(passcode, response.choices[0].message.content ?? "I'm sorry, I have encountered an error. Trick or treat!");
});

async function initThread() {
  const thread = new URLSearchParams(location.search).get("thread");
  if (thread) {
    const messages = JSON.parse(await decompressText(thread));

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
  buttonGroup.remove();

  const thread = getThread();

  const compressedThread = await compressText(JSON.stringify(thread));
  const appURL = new URL(location.href);
  appURL.searchParams.set("thread", compressedThread);

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

let wasPlayed = false;
function playAudioOnce() {
  if (!wasPlayed) {
    audio.play();
    audio.loop = true;
    wasPlayed = true;
  }

  document.querySelector("body").removeEventListener("click", playAudioOnce);
}

let isFadingOut = false;
function fadeoutAudio(min = 0) {
  if (isFadingOut) {
    return;
  }

  isFadingOut = true;
  fadeoutAudioRecusive(min);
}

function fadeoutAudioRecusive(min) {
  audio.volume = Math.max(min, audio.volume - 0.05);
  if (audio.volume > min) {
    setTimeout(() => fadeoutAudioRecusive(min), 100);
  }
}

/**
 *
 * @param {MouseEvent} e
 */
function resetGame(e) {
  e.preventDefault();

  const mutableUrl = new URL(location.href);
  mutableUrl.searchParams.delete("thread");
  location.href = mutableUrl.href;
}
