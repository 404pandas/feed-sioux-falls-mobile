import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
// The classic API (downloadAsync, cacheDirectory); SDK 54 moved it here.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api, authHeaders } from '../api/client';
import { readReceiptText } from './parse';

// Long side of a saved receipt photo. Readable for the bookkeeper (and for
// throwing the paper away), small enough to keep thousands of them.
const MAX_SIDE = 1600;

// Take a photo or pick one. Returns { uri, base64, contentType } shrunk to
// MAX_SIDE as a JPEG, or null if they cancelled.
export async function getReceiptPhoto(source) {
  // Choosing a photo uses Android's photo picker, which needs no permission
  // (and Google Play doesn't allow asking to read every photo just to pick one).
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera is off for this app', 'Turn it on in your phone settings, choose a photo instead, or type the receipt in by hand.');
      return null;
    }
  }
  const options = { mediaTypes: ['images'], quality: 1, exif: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;

  const { uri, width, height } = result.assets[0];
  const resize = Math.max(width || 0, height || 0) > MAX_SIDE ? [{ resize: width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
  const small = await ImageManipulator.manipulateAsync(uri, resize, { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  return { uri: small.uri, base64: small.base64, contentType: 'image/jpeg' };
}

// Reads the photo's text on the phone (Google ML Kit - free, offline,
// nothing is sent anywhere) and guesses store, date, total, and items.
// Returns null when text reading isn't available (Expo Go) or finds
// nothing - the form is then just filled in by hand.
export async function scanReceipt(uri, items) {
  try {
    // Required here, not at the top, so Expo Go (which doesn't include this
    // native module) still opens the receipt screen.
    const TextRecognition = require('@react-native-ml-kit/text-recognition').default;
    const result = await TextRecognition.recognize(uri);
    if (!result?.text?.trim()) return null;
    return readReceiptText(result.text, items);
  } catch {
    return null;
  }
}

// "2026-10-31 Walmart 42.50.jpg" - same name the server gives a download.
export function receiptFilename(receipt) {
  const day = String(receipt.date).slice(0, 10);
  const store = (receipt.store || 'Receipt').replace(/[^\w .&'-]+/g, '').trim().slice(0, 40) || 'Receipt';
  return `${day} ${store} ${Number(receipt.total).toFixed(2)}.jpg`;
}

async function downloadAndShare(url, filename, mimeType) {
  const target = `${FileSystem.cacheDirectory}${encodeURIComponent(filename)}`;
  const { status } = await FileSystem.downloadAsync(url, target, { headers: await authHeaders() });
  if (status !== 200) throw new Error("Couldn't download it. Check your signal and try again.");
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(target, { mimeType, dialogTitle: filename });
}

// The phone's share sheet with the photo: email it, save it to Drive, or
// open it in QuickBooks.
export function shareReceiptPhoto(receipt) {
  return downloadAndShare(api.receiptPhotoUrl(receipt._id, true), receiptFilename(receipt), 'image/jpeg');
}

// A month of receipts as a spreadsheet, for the bookkeeper (admins only).
export function shareReceiptsCsv(month) {
  return downloadAndShare(api.receiptsCsvUrl(month), `Feed Sioux Falls receipts ${month}.csv`, 'text/csv');
}
