# AI provider setup for local testing

The project uses Sarvam for Hindi/Hinglish audio transcription and OpenAI for conversation summaries, category extraction, image OCR, and document extraction. Summarization uses two separate schema-constrained OpenAI calls: first a conversation summary, then category lines based on that summary and the source messages. Provider keys are separate from Meta credentials.

## Get the API keys

1. Create an API key from the [OpenAI API platform](https://platform.openai.com/api-keys). ChatGPT login access does not provide an API key or API billing.
2. Create a Sarvam API subscription key from your Sarvam developer account. Use the [Sarvam speech-to-text API reference](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe) to see the transcription endpoint and accepted request fields.

## Set them locally

Edit the ignored project-root `.env` file and fill only these values:

```dotenv
OPENAI_API_KEY=
SARVAM_API_KEY=
```

Keep the defaults unless you have a reason to change them:

- `OPENAI_MODEL=gpt-4o-mini`
- `SARVAM_STT_MODEL=saaras:v4`
- `SARVAM_STT_MODE=codemix`
- `AI_CONFIDENCE_THRESHOLD=0.75`
- `WHATSAPP_MEDIA_DIR=./data/media`

Do not paste either key into chat, browser code, screenshots, or a committed file. Restart Spring Boot after changing `.env`; it reads the file at startup.

## Local verification sequence

The provider request/response contracts can also be checked without real credentials or provider calls:

```powershell
cd backend
mvn -Dtest=AiProviderContractTest test
```

These tests use local stub HTTP servers. They verify the two-stage OpenAI structured-output request and citation filtering, plus the Sarvam multipart transcription request and response mapping. They do not prove live provider access, billing, or media-download access.

1. Confirm `GET /api/health` reports the API as `UP`.
2. Send a supported image, document, or short voice note through the Meta test flow and let the webhook arrive.
3. Confirm the media worker downloads the asset into the ignored media directory, then extracts text with OpenAI or transcribes audio with Sarvam.
4. Once the test number has a linked group with messages, confirm the summary and its source-message list appear in the dashboard. Results below 0.75 confidence should be in review.

The current Sarvam synchronous transcription integration is intended for short voice notes. Long recordings need a batch transcription path, which is not implemented yet. Meta test-number messaging does not grant Groups API access or prove production eligibility.
