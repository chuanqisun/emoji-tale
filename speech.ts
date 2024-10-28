import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { Observable, Subject } from "rxjs";

let cachedToken: string | null = null;

export async function synthesizeSpeech(passcode: string, content: string) {
  console.log(`speak > ${content}`);
  if (!cachedToken) {
    cachedToken = await fetch(`https://proto-api.azure-api.net/halloween/issuetoken`, {
      method: "POST",
      headers: {
        "x-secret-ingredient": passcode,
      },
    }).then((res) => res.text());
  }

  const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(cachedToken!, "westus");
  const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();

  const speechSynthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  speechSynthesizer.speakTextAsync(
    content,
    (result) => {
      if (result) {
        speechSynthesizer.close();
        return result.audioData;
      }
    },
    (error) => {
      console.log(error);
      speechSynthesizer.close();
    }
  );
}

export function playNothing() {
  const audioCtx = new window.AudioContext();

  const oscillator = audioCtx.createOscillator();
  oscillator.type = "sine"; // You can use any type, but sine is silent at 0 frequency
  oscillator.frequency.setValueAtTime(0.1, audioCtx.currentTime); // Set frequency to 0 for silence

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime); // Set gain to 0 for silence

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(); // Start playing the silent audio
}

export function createSentenceQueue() {
  const sentence$ = new Subject<string>();
  let buffer = "";

  function enqueue(text: string) {
    const sentences = splitBySentence(buffer + text);
    // the last sentence is incomplete. only emit the first n-1 sentences

    const completeSpeech = sentences.slice(0, -1).join("");
    if (completeSpeech.trim()) {
      sentence$.next(completeSpeech);
    }

    buffer = sentences.at(-1) ?? "";
  }

  function flush() {
    if (buffer.trim()) {
      sentence$.next(buffer);
      buffer = "";
    }
    sentence$.complete();
  }

  return {
    sentenceQueue: sentence$ as Observable<string>,
    flush,
    enqueue,
  };
}
function splitBySentence(input: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  const iterator = segmenter.segment(input);
  const items = [...iterator].map((item) => item.segment);
  return items;
}
