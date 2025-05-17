# Receipt Splitter Feature

The Receipt Splitter is a powerful feature that allows users to scan receipts using their camera, automatically extract items and prices using OCR (Optical Character Recognition), and create debts based on the receipt contents.

## How It Works

1. Users can access the receipt splitter by tapping the receipt icon button next to "Add Debt" on the home screen
2. The app uses the device camera to take a photo of a receipt
3. The Groq API with Llama 4 Scout vision model analyzes the receipt image and extracts:
   - Store/restaurant name
   - Date of purchase
   - Individual items with prices
   - Subtotal, tax, and tip amounts
4. Users can then select which items to include in the debt and adjust quantities
5. The app calculates the total amount owed and creates a debt with detailed itemization

## Setup Instructions

### 1. Obtain a Groq API Key

1. Sign up for an account at [https://console.groq.com/](https://console.groq.com/)
2. Generate an API key from your Groq dashboard
3. Copy the API key for the next step

### 2. Configure the API Key

Open the file `config/env.js` and replace the placeholder API key with your actual Groq API key:

```javascript
export default {
  // Groq API Key - Replace with your actual key
  GROQ_API_KEY: "YOUR_GROQ_API_KEY_HERE"
};
```

### 3. Install Dependencies

Make sure all required dependencies are installed:

```bash
npm install groq-sdk react-native-base64 expo-file-system expo-image-picker
```

## Usage

1. Tap the receipt icon button on the home screen
2. Take a clear photo of a receipt
3. Wait for the OCR processing to complete (this may take a few seconds)
4. Review the extracted items and make any necessary adjustments
5. Enter the name of the person who owes you
6. Tap "Create Debt" to finalize the transaction

## Technical Details

- The app uses Groq's `meta-llama/llama-4-scout-17b-16e-instruct` model for image analysis
- Image processing happens on Groq's servers, so an internet connection is required
- Receipt images are converted to base64 format before being sent to the API
- The response is parsed and formatted to fit the app's debt creation workflow

## Troubleshooting

If you encounter issues with receipt recognition:
- Ensure the receipt is well-lit and clearly visible in the photo
- Make sure the entire receipt is captured in the frame
- Check that your Groq API key is valid and properly configured
- Verify that your device has an internet connection

## Privacy Note

Receipt images are processed by Groq's API. Please review Groq's privacy policy for information on how they handle data. 