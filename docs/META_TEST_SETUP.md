# Meta WhatsApp test setup

This project uses Meta's Cloud API test assets first. Keep the test token and app secret in the ignored root `.env` file; never commit them or send them in chat.

## Find the test token and IDs

1. Sign in to [Meta for Developers](https://developers.facebook.com/apps/) and open the app that has the WhatsApp product configured.
2. Open **WhatsApp → API Setup** in the app dashboard.
3. Copy the temporary access token into `META_ACCESS_TOKEN`.
4. Copy the test sender's **Phone number ID** into `META_PHONE_NUMBER_ID`.
5. Copy the **WhatsApp Business Account ID** into `META_WABA_ID`.
6. Leave `META_GRAPH_API_VERSION=v23.0` for this project version. It is configurable when upgrading the Graph API version later.
7. Add your own WhatsApp number as an allowed test recipient in the same API Setup page if you later want to send a test message. The current connection check does not send any message.

The API Setup page is the starting point in Meta's [Cloud API Get Started guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started). Meta's [official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) describes the phone-number and WABA ID fields and the test-message request.

## App secret and webhook verify token

- In the app dashboard, open **App settings → Basic**, reveal the **App Secret**, and put it in `META_APP_SECRET`. This is needed to validate incoming webhook POST signatures; it is not needed for the phone profile check.
- Generate your own long random value for `META_WEBHOOK_VERIFY_TOKEN`. Meta does not issue this value. When the webhook is configured in the app dashboard, enter the same value there.
- The receiver is `GET/POST /webhook/whatsapp`. Meta requires a public HTTPS callback to reach a local service; for local webhook tests, expose port 8081 through a tunnel and use its HTTPS URL with `/webhook/whatsapp` appended.

## Check the connection

Save `.env`, start the backend using the local profile, then open `http://localhost:8081/api/meta/test-connection`. A successful result includes the test phone's display number and verified name. The token is sent only by the backend to Graph API and is not returned to the browser.

The Meta test number validates Cloud API setup. It does not prove Groups API access: Meta's [Groups API documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups) has separate account and phone-number eligibility requirements. Keep group calls behind the API adapter until the business number's eligibility is known.
