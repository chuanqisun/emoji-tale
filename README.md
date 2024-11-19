# Poemoji

This is a one-off Halloween project.

The app lets user "choose your adventure" by picking emojis and adding captions. The users will use QR code to pass the game to the next person.

In the end, LLM will generate a poem based on users choices.

## Get started

The initial player needs to use the following URL to setup authentication with OpenAI and Azure Speech

```
https://chuanqisun.github.io/poemoji/?speechRegion=******&speechKey=***********&llmKey=************

```

- `speechRegion` is the region for Azure Speech service, e.g. `eastus`, `westus`, etc.
- `speechKey` is the key for Azure Speech service
- `llmKey` is the key for OpenAI Chat Completion API
