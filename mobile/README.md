# Studify Mobile App (React Native / Expo)

This mobile app complements the **Studify** web platform, connecting to the shared Render backend (`https://studify-dcq6.onrender.com/api`) and PostgreSQL database.

---

## Features
- **Cross-Platform Sync**: Instant synchronization of XP, study streaks, test results, and group chat with the website.
- **Push Notifications**: Expo push notification integration for Daily Mock Arena reminders, chat messages, and group quiz countdowns.
- **Daily Mock Arena**: Mobile-optimized test runner for daily timed mocks.
- **Curriculum Catalog**: Direct access to Class 9–12, MDCAT (PMDC), and ECAT (UET).

---

## Running Locally

1. **Install Expo CLI globally** (if not already installed):
   ```bash
   npm install -g expo-cli eas-cli
   ```

2. **Navigate to the mobile directory**:
   ```bash
   cd mobile
   npm install
   ```

3. **Start the development server**:
   ```bash
   npx expo start
   ```

4. **Testing on a Physical Device**:
   - Install **Expo Go** from Google Play Store (Android) or Apple App Store (iOS).
   - Scan the QR code printed in the terminal.

---

## Building Production APK (Android)

To generate an installable `.apk` file for testing:

1. **Login to EAS**:
   ```bash
   eas login
   ```

2. **Configure project**:
   ```bash
   eas build:configure
   ```

3. **Build APK preview**:
   ```bash
   eas build -p android --profile preview
   ```
