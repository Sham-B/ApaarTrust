/**
 * Internationalization (i18n) Module for ApaarTrust
 * Supports English (en), Hindi (hi), and Tamil (ta)
 * Technical terms are kept clear in English/transliteration
 */

import { store } from './store.js';

export const DICTIONARY = {
  en: {
    nav_overview: 'Overview',
    nav_institutions: 'Institutions',
    nav_findings: 'Findings',
    nav_duplicates: 'Duplicates',
    nav_upload: 'Upload Roster',
    nav_students: 'Students',
    nav_certificates: 'Certificates',
    nav_submissions: 'Submissions',
    nav_todos: 'Action Items',
    nav_record: 'My Record',
    nav_consent: 'Consent Manager',
    nav_activity: 'Activity & Audit',
    nav_share: 'Share Presentation',
    nav_verify: 'Public Verifier',
    nav_assistant: 'AI Assistant',
    nav_audit: 'Audit Log',

    btn_ask: 'Ask ApaarTrust',
    btn_search: 'Search or command...',
    btn_verify: 'Verify Credential',
    btn_submit: 'Submit Roster',
    btn_dry_run: 'Simulate Dry Run',
    btn_download: 'Download',
    btn_copy: 'Copy',
    btn_close: 'Close',
    btn_back_home: 'Back to Home',
    btn_fullpage: 'Full Page',
    btn_clear: 'Clear',

    status_good: 'Compliant',
    status_look: 'Needs Review',
    status_problem: 'Non-Compliant',
    status_waiting: 'Pending Simulation',
    status_genuine: 'Genuine',
    status_revoked: 'Revoked',
    status_expired: 'Expired',
    status_tampered: 'Tampered',
    status_not_found: 'Not Found',

    assistant_welcome: 'Ask questions regarding AICTE validation norms, seat matrices, or regulatory findings. Grounded strictly in local YAML rules.',
    assistant_disclaimer: 'Demo assistant. Not legal or regulatory advice. Grounded strictly in configured YAML rules.',
    assistant_placeholder: 'Ask compliance or verification question...',
  },

  hi: {
    nav_overview: 'अवलोकन (Overview)',
    nav_institutions: 'संस्थान (Institutions)',
    nav_findings: 'नियामक निष्कर्ष (Findings)',
    nav_duplicates: 'दोहरे नामांकन (Duplicates)',
    nav_upload: 'डेटा अपलोड (Upload)',
    nav_students: 'छात्र (Students)',
    nav_certificates: 'प्रमाणपत्र (Certificates)',
    nav_submissions: 'प्रस्तुतियां (Submissions)',
    nav_todos: 'कार्य सूची (Action Items)',
    nav_record: 'मेरा रिकॉर्ड (My Record)',
    nav_consent: 'सहमति प्रबंधक (Consent)',
    nav_activity: 'गतिविधि एवं ऑडिट (Activity)',
    nav_share: 'प्रस्तुति साझा करें (Share)',
    nav_verify: 'सार्वजनिक सत्यापन (Verifier)',
    nav_assistant: 'एआई सहायक (Assistant)',
    nav_audit: 'ऑडिट लॉग (Audit Log)',

    btn_ask: 'अपारट्रस्ट से पूछें',
    btn_search: 'खोजें या कमांड...',
    btn_verify: 'सत्यापन करें',
    btn_submit: 'प्रस्तुत करें',
    btn_dry_run: 'ड्राय-रन अनुकरण',
    btn_download: 'डाउनलोड करें',
    btn_copy: 'कॉपी करें',
    btn_close: 'बंद करें',
    btn_back_home: 'होम पर वापस जाएं',
    btn_fullpage: 'पूर्ण पृष्ठ',
    btn_clear: 'साफ़ करें',

    status_good: 'अनुपालन (Compliant)',
    status_look: 'समीक्षा आवश्यक (Review)',
    status_problem: 'गंभीर उल्लंघन (Problem)',
    status_waiting: 'प्रतीक्षारत (Pending)',
    status_genuine: 'सत्यापित (Genuine)',
    status_revoked: 'रद्द (Revoked)',
    status_expired: 'समाप्त (Expired)',
    status_tampered: 'छेड़छाड़ (Tampered)',
    status_not_found: 'अमान्य (Not Found)',

    assistant_welcome: 'एआईसीटीई नियमों, सीट आवंटन और निष्कर्षों पर प्रश्न पूछें। उत्तर स्थानीय नियमों पर आधारित हैं।',
    assistant_disclaimer: 'डेमो सहायक। कानूनी या वैधानिक सलाह नहीं। स्थानीय YAML नियमों पर आधारित।',
    assistant_placeholder: 'अनुपालन या सत्यापन पर प्रश्न पूछें...',
  },

  ta: {
    nav_overview: 'மேலோட்டம் (Overview)',
    nav_institutions: 'நிறுவனங்கள் (Institutions)',
    nav_findings: 'ஒழுங்குமுறை கண்டுபிடிப்புகள் (Findings)',
    nav_duplicates: 'இரட்டை சேர்க்கைகள் (Duplicates)',
    nav_upload: 'தரவு பதிவேற்றம் (Upload)',
    nav_students: 'மாணவர்கள் (Students)',
    nav_certificates: 'சான்றிதழ்கள் (Certificates)',
    nav_submissions: 'சமர்ப்பிப்புகள் (Submissions)',
    nav_todos: 'செயல் உருப்படிகள் (Action Items)',
    nav_record: 'என் பதிவு (My Record)',
    nav_consent: 'ஒப்புதல் மேலாளர் (Consent)',
    nav_activity: 'செயல்பாடு & தணிக்கை (Activity)',
    nav_share: 'பகிர் (Share)',
    nav_verify: 'சரிபார்ப்பாளர் (Verifier)',
    nav_assistant: 'AI உதவியாளர் (Assistant)',
    nav_audit: 'தணிக்கை பதிவு (Audit Log)',

    btn_ask: 'அபார்ட்ரஸ்ட்டிடம் கேளுங்கள்',
    btn_search: 'தேடுங்கள் அல்லது கட்டளை...',
    btn_verify: 'சரிபார்க்கவும்',
    btn_submit: 'சமர்ப்பிக்கவும்',
    btn_dry_run: 'சோதனை ஓட்டம்',
    btn_download: 'பதிவிறக்கவும்',
    btn_copy: 'நகலெடு',
    btn_close: 'மூடு',
    btn_back_home: 'முகப்புக்குச் செல்',
    btn_fullpage: 'முழு பக்கம்',
    btn_clear: 'அழி',

    status_good: 'இணக்கமானது (Compliant)',
    status_look: 'மறுஆய்வு தேவை (Review)',
    status_problem: 'சிக்கல் (Problem)',
    status_waiting: 'காத்திருக்கிறது (Pending)',
    status_genuine: 'உண்மையானது (Genuine)',
    status_revoked: 'ரத்து செய்யப்பட்டது (Revoked)',
    status_expired: 'காலாவதியானது (Expired)',
    status_tampered: 'மாற்றப்பட்டது (Tampered)',
    status_not_found: 'காணப்படவில்லை (Not Found)',

    assistant_welcome: 'AICTE விதிமுறைகள் மற்றும் சரிபார்ப்பு பற்றிய கேள்விகளைக் கேளுங்கள். பதில்கள் உள்ளூர் விதிகளின் அடிப்படையில் மட்டுமே.',
    assistant_disclaimer: 'டெமோ உதவியாளர். சட்ட ஆலோசனை அல்ல. உள்ளூர் YAML விதிகளின் அடிப்படையில் மட்டுமே.',
    assistant_placeholder: 'இணக்கம் அல்லது சரிபார்ப்பு பற்றி கேளுங்கள்...',
  },
};

export function t(key, fallback = '') {
  const lang = store.getState().lang || 'en';
  const dict = DICTIONARY[lang] || DICTIONARY.en;
  return dict[key] || fallback || DICTIONARY.en[key] || key;
}

export function getCurrentLang() {
  return store.getState().lang || 'en';
}
