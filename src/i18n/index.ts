import { ru, type Translations } from "./ru.js";
import { en } from "./en.js";
import { zhCN } from "./zh-CN.js";
import { zhTW } from "./zh-TW.js";
import { uk } from "./uk.js";
import { be } from "./be.js";
import { es } from "./es.js";
import { it } from "./it.js";
import { pt } from "./pt.js";
import { ja } from "./ja.js";
import { sr } from "./sr.js";
import { fr } from "./fr.js";
import { de } from "./de.js";
import { hi } from "./hi.js";
import { ar } from "./ar.js";
import { id } from "./id.js";
import { ko } from "./ko.js";
import { tr } from "./tr.js";
import { vi } from "./vi.js";
import { pl } from "./pl.js";
import { nl } from "./nl.js";
import { ro } from "./ro.js";
import { el } from "./el.js";
import { sv } from "./sv.js";
import { kk } from "./kk.js";
import { az } from "./az.js";
import { th } from "./th.js";
import { bn } from "./bn.js";
import { pa } from "./pa.js";
import { bg } from "./bg.js";
import { cs } from "./cs.js";
import { fil } from "./fil.js";
import { fa } from "./fa.js";
import { ms } from "./ms.js";
import { my } from "./my.js";
import { am } from "./am.js";
import { mr } from "./mr.js";

export type { Translations } from "./ru.js";

export const languages = {
  Russian: ru,
  English: { ...ru, ...en },
  Chinese: { ...ru, ...zhCN },
  ChineseSimplified: { ...ru, ...zhCN },
  Ukrainian: { ...ru, ...uk },
  Belarusian: { ...ru, ...be },
  Spanish: { ...ru, ...es },
  Italian: { ...ru, ...it },
  Portuguese: { ...ru, ...pt },
  Japanese: { ...ru, ...ja },
  Serbian: { ...ru, ...sr },
  French: { ...ru, ...fr },
  German: { ...ru, ...de },
  Hindi: { ...ru, ...hi },
  Arabic: { ...ru, ...ar },
  Indonesian: { ...ru, ...id },
  Korean: { ...ru, ...ko },
  Turkish: { ...ru, ...tr },
  Vietnamese: { ...ru, ...vi },
  Polish: { ...ru, ...pl },
  Dutch: { ...ru, ...nl },
  Romanian: { ...ru, ...ro },
  Greek: { ...ru, ...el },
  Swedish: { ...ru, ...sv },
  Kazakh: { ...ru, ...kk },
  Azerbaijani: { ...ru, ...az },
  Thai: { ...ru, ...th },
  Bengali: { ...ru, ...bn },
  Punjabi: { ...ru, ...pa },
  Bulgarian: { ...ru, ...bg },
  Czech: { ...ru, ...cs },
  Filipino: { ...ru, ...fil },
  Persian: { ...ru, ...fa },
  Malay: { ...ru, ...ms },
  Burmese: { ...ru, ...my },
  Amharic: { ...ru, ...am },
  Marathi: { ...ru, ...mr },
} as const;

export type LangCode = keyof typeof languages;

export const languageOptions: { value: LangCode; label: string }[] = [
  { value: "Russian", label: ru.langRussian },
  { value: "English", label: ru.langEnglish },
  { value: "ChineseSimplified", label: ru.langChineseSimplified },
  { value: "Spanish", label: ru.langSpanish },
  { value: "French", label: ru.langFrench },
  { value: "German", label: ru.langGerman },
  { value: "Arabic", label: ru.langArabic },
  { value: "Portuguese", label: ru.langPortuguese },
  { value: "Japanese", label: ru.langJapanese },
  { value: "Italian", label: ru.langItalian },
  { value: "Ukrainian", label: ru.langUkrainian },
  { value: "Hindi", label: ru.langHindi },
  { value: "Indonesian", label: ru.langIndonesian },
  { value: "Chinese", label: ru.langChinese },
  { value: "Serbian", label: ru.langSerbian },
  { value: "Belarusian", label: ru.langBelarusian },
  { value: "Korean", label: ru.langKorean },
  { value: "Turkish", label: ru.langTurkish },
  { value: "Vietnamese", label: ru.langVietnamese },
  { value: "Polish", label: ru.langPolish },
  { value: "Dutch", label: ru.langDutch },
  { value: "Romanian", label: ru.langRomanian },
  { value: "Greek", label: ru.langGreek },
  { value: "Swedish", label: ru.langSwedish },
  { value: "Kazakh", label: ru.langKazakh },
  { value: "Azerbaijani", label: ru.langAzerbaijani },
  { value: "Thai", label: ru.langThai },
  { value: "Bengali", label: ru.langBengali },
  { value: "Punjabi", label: ru.langPunjabi },
  { value: "Bulgarian", label: ru.langBulgarian },
  { value: "Czech", label: ru.langCzech },
  { value: "Filipino", label: ru.langFilipino },
  { value: "Persian", label: ru.langPersian },
  { value: "Malay", label: ru.langMalay },
  { value: "Burmese", label: ru.langBurmese },
  { value: "Amharic", label: ru.langAmharic },
  { value: "Marathi", label: ru.langMarathi },
];

export const languageLabels: Record<LangCode, string> = {
  Russian: "Русский",
  English: "English",
  Chinese: "中文 (繁体)",
  ChineseSimplified: "简体中文",
  Ukrainian: "Українська",
  Belarusian: "Беларуская",
  Spanish: "Español",
  Italian: "Italiano",
  Portuguese: "Português",
  Japanese: "日本語",
  Serbian: "Srpski",
  French: "Français",
  German: "Deutsch",
  Hindi: "हिन्दी",
  Arabic: "العربية",
  Indonesian: "Indonesia",
  Korean: "한국어",
  Turkish: "Türkçe",
  Vietnamese: "Tiếng Việt",
  Polish: "Polski",
  Dutch: "Nederlands",
  Romanian: "Română",
  Greek: "Ελληνικά",
  Swedish: "Svenska",
  Kazakh: "Қазақша",
  Azerbaijani: "Azərbaycanca",
  Thai: "ไทย",
  Bengali: "বাংলা",
  Punjabi: "ਪੰਜਾਬੀ",
  Bulgarian: "Български",
  Czech: "Čeština",
  Filipino: "Filipino",
  Persian: "فارسی",
  Malay: "Melayu",
  Burmese: "မြန်မာဘာသာ",
  Amharic: "አማርኛ",
  Marathi: "मराठी",
};
