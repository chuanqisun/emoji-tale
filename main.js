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
const startButton = document.querySelector("#start");
const resetButton = document.querySelector("#reset");
audio.src = soundtrackUrl;

initThread();

document.querySelector("body").addEventListener("click", playAudioOnce);

appName.addEventListener("click", resetGame);

startButton.addEventListener("click", handleStart);
continueButton.addEventListener("click", startSeed);
resetButton.addEventListener("click", resetGame);

shareContainer.addEventListener("click", handleShareByURL);

finishButton.addEventListener("click", async () => {
  // reveal the story
  document.querySelectorAll("[data-text]").forEach((hiddenText) => (hiddenText.textContent = hiddenText.getAttribute("data-text")));

  buttonGroup.setAttribute("hidden", "");

  shareContainer.textContent = "Piecing together the verses...";

  const passcode = await passcodeAsync;

  const thread = getThread();
  const response = await getChatResponse(
    passcode,
    "gpt-4o",
    [
      {
        role: "system",
        content: `Convert the emoji and text into a short Halloween themed ghost poem. Try to be funny, ridiculous, and creative. Make sure each line of emoji + text is converted to exactly one line of verse. No title.`,
      },
      {
        role: "user",
        content: thread.map((item, index) => `Line${thread.length > 1 ? ` ${index + 1}` : ""}: ${item.emoji} ${item.text}`).join("\n"),
      },
    ],
    {
      max_tokens: 4_000,
      temperature: 0.75,
    }
  );

  resetButton.removeAttribute("hidden");

  fadeoutAudio(0.05);

  shareContainer.textContent = response.choices[0].message.content;
  synthesizeSpeech(passcode, response.choices[0].message.content ?? "I'm sorry, I have encountered an error. Trick or treat!");
});

async function initThread() {
  const thread = new URLSearchParams(location.search).get("thread");
  if (thread) {
    const messages = JSON.parse(await decompressText(thread));
    startButton.textContent = "CONTINUE";

    const items = messages.map((message) => {
      const cloned = messageTemplate.content.cloneNode(true);
      cloned.querySelector(".message-card").setAttribute("data-previous-item", "");
      cloned.querySelector("[data-emoji]").textContent = message.emoji;
      cloned.querySelector("[data-text]").textContent = message.text.replace(/./g, "*");
      cloned.querySelector("[data-text]").setAttribute("data-text", message.text);

      return cloned;
    });

    document.querySelector(".thread").prepend(...items);
  } else {
    finishButton.setAttribute("hidden", "");
  }

  const randomEmojis = getRandomEmojis(4);
  if (randomEmojis.length) {
    emojiInput.innerHTML = randomEmojis
      .map(
        (emoji, i) =>
          `<label data-emoji class="emoji-choice"><input type="radio" name="selectedEmoji" class="visually-hidden" value="${emoji}" ${
            i === 0 ? "checked" : ""
          } />${emoji}</label>`
      )
      .join("");
  } else {
    continueButton.remove();
    finishButton.classList.remove("secondary");
    newMessageCard.remove();
  }

  buttonGroup.removeAttribute("hidden");
}

function getRandomEmojis(count) {
  const usedEmojis = new Set([...document.querySelectorAll("[data-emoji]")].map((emoji) => emoji.textContent.trim()));
  const unusedEmojis = emojiList.filter((emoji) => !usedEmojis.has(emoji));
  const availableEmojis = unusedEmojis.slice(0, count);
  const shuffledEmojis = availableEmojis.sort(() => Math.random() - 0.5);

  return shuffledEmojis;
}

function handleStart() {
  startButton.remove();
  continueButton.removeAttribute("hidden");
  finishButton.removeAttribute("hidden");
  newMessageCard.removeAttribute("hidden");
}

async function startSeed() {
  fadeoutAudio(0);

  const thread = getThread();

  const compressedThread = await compressText(JSON.stringify(thread));
  const appURL = new URL(location.href);
  appURL.searchParams.set("thread", compressedThread);

  shareContainer.innerHTML = `<a href="${appURL.href}" data-share-by-url><qr-code format="svg" modulesize="4" data="${appURL.href}"></qr-code></a>`;
}

function getThread() {
  const isNewMessageHidden = newMessageCard.hasAttribute("hidden");

  const thread = [
    ...[...document.querySelectorAll("[data-previous-item]")].map((card) => ({
      emoji: card.querySelector("[data-emoji]").textContent,
      text: card.querySelector("[data-text]").getAttribute("data-text"),
    })),
    ...(isNewMessageHidden
      ? []
      : [
          {
            emoji: emojiInput.querySelector("input:checked").value,
            text: promptInput.value,
          },
        ]),
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

function handleShareByURL(e) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    return;
  }
  if (typeof navigator.share === "function" && e.target?.closest("[data-share-by-url]")) {
    e.preventDefault();
    const url = e.target.closest("[data-share-by-url]").href;

    navigator.share({
      title: "Poemoji",
      text: "Let's write a Halloween ghost poem together!",
      url,
    });
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
