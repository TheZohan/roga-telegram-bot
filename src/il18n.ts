import i18n from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';

const defaultLanguage = process.env.LANGUAGE || 'en-US';

i18n.use(Backend).init({
  backend: {
    loadPath: path.join(__dirname, '/../locales/{{lng}}.json'),
  },
  fallbackLng: defaultLanguage,
  preload: ['en', 'heb'], // preload all languages
  interpolation: {
    escapeValue: false, // not needed for backend
  },
});

export default i18n;
