<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d609e82b-fba7-4550-be56-85e865149b9c

## Run Locally

**Prerequisites:** Node.js, PHP 8+ (for Taecel wrapper)

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the PHP wrapper from the project root (required for the Taecel PHP fallback):
   `php -S localhost:8080 -t libreriaTaecel/libreriaTaecel`
4. Run the app:
   `npm run dev`

> If you have different PHP path, set `TAECEL_PHP_URL` in `.env.local`, for example:
> `TAECEL_PHP_URL=http://localhost:8080/TaecelREST.php`
