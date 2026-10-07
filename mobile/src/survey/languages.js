import en from './strings/en';
import es from './strings/es';

// The app offers English and Spanish - the two languages with full
// translations on the website. The website also lists Nepali, Swahili,
// Arabic, Dakota and Lakota as "help us translate" placeholders; once one
// of those is translated there, copy its strings file here and add it below.
//
// The shared strings files are written for a web page ("press Esc", "clear
// your browser history", "opens a weather page"). APP_UI replaces those
// lines with wording that's true inside the app, and adds the few app-only
// lines. Spanish lines here should get the same native-speaker check as the
// website's before launch.
const APP_UI = {
  en: {
    quickExitExplain: 'Need to stop fast? Tap Quick Exit at the top. It erases your answers right away.',
    quickExitDone: 'Answers erased.',
    savedNote: 'Your answers save on this phone as you go, in case you lose signal. They are erased when you send the survey.',
    queuedTitle: 'Thank you',
    queuedBody: 'There is no signal right now, so your survey will send by itself as soon as this phone is back online. Your answers are not shown anywhere on this phone.',
    handBack: 'Please hand the phone back to the volunteer.',
    closeTitle: 'Leave the survey?',
    closeBody: 'Your answers so far stay saved on this phone for 12 hours so you can come back.',
    closeLeave: 'Leave',
    closeStay: 'Stay',
    shareUnavailable: 'Sharing turns on once the survey website address is added to the app settings.',
    qrTitle: 'Scan to take the survey on your own phone',
  },
  es: {
    quickExitExplain: '¿Necesita parar rápido? Toque Salida rápida arriba. Borra sus respuestas de inmediato.',
    quickExitDone: 'Respuestas borradas.',
    savedNote: 'Sus respuestas se guardan en este teléfono mientras avanza, por si pierde la señal. Se borran cuando envía la encuesta.',
    queuedTitle: 'Gracias',
    queuedBody: 'No hay señal en este momento, así que su encuesta se enviará sola en cuanto este teléfono vuelva a tener conexión. Sus respuestas no se muestran en ninguna parte de este teléfono.',
    handBack: 'Por favor, devuelva el teléfono al voluntario.',
    closeTitle: '¿Salir de la encuesta?',
    closeBody: 'Sus respuestas se quedan guardadas en este teléfono por 12 horas para que pueda volver.',
    closeLeave: 'Salir',
    closeStay: 'Quedarme',
    shareUnavailable: 'Compartir se activa cuando se agregue la dirección del sitio web de la encuesta a la configuración de la aplicación.',
    qrTitle: 'Escanee para llenar la encuesta en su propio teléfono',
  },
};

function forApp(code, strings) {
  return { ...strings, ui: { ...strings.ui, ...APP_UI[code] } };
}

export const LANGUAGES = [
  { code: 'en', nativeName: 'English', speechLang: 'en-US', strings: forApp('en', en) },
  { code: 'es', nativeName: 'Español', speechLang: 'es-US', strings: forApp('es', es) },
];

export const DEFAULT_LANGUAGE = 'en';

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
