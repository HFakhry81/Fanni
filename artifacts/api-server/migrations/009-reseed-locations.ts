/**
 * Migration / Seed: 009-reseed-locations
 *
 * Performs a full canonical reseed of the `locations` table:
 *   1. DELETEs all neighborhood rows (removed in v2 schema).
 *   2. UPSERTs the authoritative 27-governorate / 396-city dataset via ON CONFLICT DO UPDATE.
 *      Existing rows with the same canonical ID are updated to match the dataset.
 *      Stale old-format rows whose IDs no longer exist in the dataset must be cleaned up
 *      separately (see migration 007 for the initial neighborhoods cleanup).
 *
 * Safe to re-run (idempotent): INSERT ... ON CONFLICT (id) DO UPDATE guarantees
 * that re-runs update existing rows rather than failing on duplicate keys.
 *
 * Requires 004-create-locations-tables and 008-add-location-centroid to run first.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/009-reseed-locations.ts
 */

import pg from "pg";

const EGYPT_LOCATIONS: Array<{ id: string; ar: string; en: string; areas: Array<{ id: string; ar: string; en: string }> }> = [
  {
    id: "cairo",
    ar: "القاهرة",
    en: "Cairo",
    areas: [
      { id: "cairo__15_may", ar: "15 مايو", en: "15 May" },
      { id: "cairo__al_azbakeyah", ar: "الازبكية", en: "Al Azbakeyah" },
      { id: "cairo__al_basatin", ar: "البساتين", en: "Al Basatin" },
      { id: "cairo__tebin", ar: "التبين", en: "Tebin" },
      { id: "cairo__elkhalifa", ar: "الخليفة", en: "El-Khalifa" },
      { id: "cairo__el_darrasa", ar: "الدراسة", en: "El darrasa" },
      { id: "cairo__aldarb_alahmar", ar: "الدرب الاحمر", en: "Aldarb Alahmar" },
      { id: "cairo__zawya_alhamra", ar: "الزاوية الحمراء", en: "Zawya al-Hamra" },
      { id: "cairo__elzaytoun", ar: "الزيتون", en: "El-Zaytoun" },
      { id: "cairo__sahel", ar: "الساحل", en: "Sahel" },
      { id: "cairo__el_salam", ar: "السلام", en: "El Salam" },
      { id: "cairo__sayeda_zeinab", ar: "السيدة زينب", en: "Sayeda Zeinab" },
      { id: "cairo__el_sharabeya", ar: "الشرابية", en: "El Sharabeya" },
      { id: "cairo__shorouk", ar: "مدينة الشروق", en: "Shorouk" },
      { id: "cairo__el_daher", ar: "الظاهر", en: "El Daher" },
      { id: "cairo__ataba", ar: "العتبة", en: "Ataba" },
      { id: "cairo__new_cairo", ar: "القاهرة الجديدة", en: "New Cairo" },
      { id: "cairo__el_marg", ar: "المرج", en: "El Marg" },
      { id: "cairo__ezbet_el_nakhl", ar: "عزبة النخل", en: "Ezbet el Nakhl" },
      { id: "cairo__matareya", ar: "المطرية", en: "Matareya" },
      { id: "cairo__maadi", ar: "المعادى", en: "Maadi" },
      { id: "cairo__maasara", ar: "المعصرة", en: "Maasara" },
      { id: "cairo__mokattam", ar: "المقطم", en: "Mokattam" },
      { id: "cairo__manyal", ar: "المنيل", en: "Manyal" },
      { id: "cairo__mosky", ar: "الموسكى", en: "Mosky" },
      { id: "cairo__nozha", ar: "النزهة", en: "Nozha" },
      { id: "cairo__waily", ar: "الوايلى", en: "Waily" },
      { id: "cairo__bab_alshereia", ar: "باب الشعرية", en: "Bab al-Shereia" },
      { id: "cairo__bolaq", ar: "بولاق", en: "Bolaq" },
      { id: "cairo__garden_city", ar: "جاردن سيتى", en: "Garden City" },
      { id: "cairo__hadayek_elkobba", ar: "حدائق القبة", en: "Hadayek El-Kobba" },
      { id: "cairo__helwan", ar: "حلوان", en: "Helwan" },
      { id: "cairo__dar_al_salam", ar: "دار السلام", en: "Dar Al Salam" },
      { id: "cairo__shubra", ar: "شبرا", en: "Shubra" },
      { id: "cairo__tura", ar: "طره", en: "Tura" },
      { id: "cairo__abdeen", ar: "عابدين", en: "Abdeen" },
      { id: "cairo__abaseya", ar: "عباسية", en: "Abaseya" },
      { id: "cairo__ain_shams", ar: "عين شمس", en: "Ain Shams" },
      { id: "cairo__nasr_city", ar: "مدينة نصر", en: "Nasr City" },
      { id: "cairo__new_heliopolis", ar: "مصر الجديدة", en: "New Heliopolis" },
      { id: "cairo__masr_al_qadima", ar: "مصر القديمة", en: "Masr Al Qadima" },
      { id: "cairo__mansheya_nasir", ar: "منشية ناصر", en: "Mansheya Nasir" },
      { id: "cairo__badr_city", ar: "مدينة بدر", en: "Badr City" },
      { id: "cairo__obour_city", ar: "مدينة العبور", en: "Obour City" },
      { id: "cairo__cairo_downtown", ar: "وسط البلد", en: "Cairo Downtown" },
      { id: "cairo__zamalek", ar: "الزمالك", en: "Zamalek" },
      { id: "cairo__kasr_el_nile", ar: "قصر النيل", en: "Kasr El Nile" },
      { id: "cairo__rehab", ar: "الرحاب", en: "Rehab" },
      { id: "cairo__katameya", ar: "القطامية", en: "Katameya" },
      { id: "cairo__madinty", ar: "مدينتي", en: "Madinty" },
      { id: "cairo__rod_alfarag", ar: "روض الفرج", en: "Rod Alfarag" },
      { id: "cairo__sheraton", ar: "شيراتون", en: "Sheraton" },
      { id: "cairo__elgamaleya", ar: "الجمالية", en: "El-Gamaleya" },
      { id: "cairo__10th_of_ramadan_city", ar: "العاشر من رمضان", en: "10th of Ramadan City" },
      { id: "cairo__helmeyat_alzaytoun", ar: "الحلمية", en: "Helmeyat Alzaytoun" },
      { id: "cairo__new_nozha", ar: "النزهة الجديدة", en: "New Nozha" },
      { id: "cairo__capital_new", ar: "العاصمة الإدارية", en: "Capital New" },
    ],
  },
  {
    id: "giza",
    ar: "الجيزة",
    en: "Giza",
    areas: [
      { id: "giza__giza", ar: "الجيزة", en: "Giza" },
      { id: "giza__sixth_of_october", ar: "السادس من أكتوبر", en: "Sixth of October" },
      { id: "giza__cheikh_zayed", ar: "الشيخ زايد", en: "Cheikh Zayed" },
      { id: "giza__hawamdiyah", ar: "الحوامدية", en: "Hawamdiyah" },
      { id: "giza__al_badrasheen", ar: "البدرشين", en: "Al Badrasheen" },
      { id: "giza__saf", ar: "الصف", en: "Saf" },
      { id: "giza__atfih", ar: "أطفيح", en: "Atfih" },
      { id: "giza__al_ayat", ar: "العياط", en: "Al Ayat" },
      { id: "giza__albawaiti", ar: "الباويطي", en: "Al-Bawaiti" },
      { id: "giza__manshiyetal_qanater", ar: "منشأة القناطر", en: "ManshiyetAl Qanater" },
      { id: "giza__oaseem", ar: "أوسيم", en: "Oaseem" },
      { id: "giza__kerdasa", ar: "كرداسة", en: "Kerdasa" },
      { id: "giza__abu_nomros", ar: "أبو النمرس", en: "Abu Nomros" },
      { id: "giza__kafr_ghati", ar: "كفر غطاطي", en: "Kafr Ghati" },
      { id: "giza__manshiyet_al_bakari", ar: "منشأة البكاري", en: "Manshiyet Al Bakari" },
      { id: "giza__dokki", ar: "الدقى", en: "Dokki" },
      { id: "giza__agouza", ar: "العجوزة", en: "Agouza" },
      { id: "giza__haram", ar: "الهرم", en: "Haram" },
      { id: "giza__warraq", ar: "الوراق", en: "Warraq" },
      { id: "giza__imbaba", ar: "امبابة", en: "Imbaba" },
      { id: "giza__boulaq_dakrour", ar: "بولاق الدكرور", en: "Boulaq Dakrour" },
      { id: "giza__al_wahat_al_baharia", ar: "الواحات البحرية", en: "Al Wahat Al Baharia" },
      { id: "giza__omraneya", ar: "العمرانية", en: "Omraneya" },
      { id: "giza__moneeb", ar: "المنيب", en: "Moneeb" },
      { id: "giza__bin_alsarayat", ar: "بين السرايات", en: "Bin Alsarayat" },
      { id: "giza__kit_kat", ar: "الكيت كات", en: "Kit Kat" },
      { id: "giza__mohandessin", ar: "المهندسين", en: "Mohandessin" },
      { id: "giza__faisal", ar: "فيصل", en: "Faisal" },
      { id: "giza__abu_rawash", ar: "أبو رواش", en: "Abu Rawash" },
      { id: "giza__hadayek_alahram", ar: "حدائق الأهرام", en: "Hadayek Alahram" },
      { id: "giza__haraneya", ar: "الحرانية", en: "Haraneya" },
      { id: "giza__hadayek_october", ar: "حدائق اكتوبر", en: "Hadayek October" },
      { id: "giza__saft_allaban", ar: "صفط اللبن", en: "Saft Allaban" },
      { id: "giza__smart_village", ar: "القرية الذكية", en: "Smart Village" },
      { id: "giza__ard_ellwaa", ar: "ارض اللواء", en: "Ard Ellwaa" },
    ],
  },
  {
    id: "alexandria",
    ar: "الإسكندرية",
    en: "Alexandria",
    areas: [
      { id: "alexandria__abu_qir", ar: "ابو قير", en: "Abu Qir" },
      { id: "alexandria__al_ibrahimeyah", ar: "الابراهيمية", en: "Al Ibrahimeyah" },
      { id: "alexandria__azarita", ar: "الأزاريطة", en: "Azarita" },
      { id: "alexandria__anfoushi", ar: "الانفوشى", en: "Anfoushi" },
      { id: "alexandria__dekheila", ar: "الدخيلة", en: "Dekheila" },
      { id: "alexandria__el_soyof", ar: "السيوف", en: "El Soyof" },
      { id: "alexandria__ameria", ar: "العامرية", en: "Ameria" },
      { id: "alexandria__el_labban", ar: "اللبان", en: "El Labban" },
      { id: "alexandria__al_mafrouza", ar: "المفروزة", en: "Al Mafrouza" },
      { id: "alexandria__el_montaza", ar: "المنتزه", en: "El Montaza" },
      { id: "alexandria__mansheya", ar: "المنشية", en: "Mansheya" },
      { id: "alexandria__naseria", ar: "الناصرية", en: "Naseria" },
      { id: "alexandria__ambrozo", ar: "امبروزو", en: "Ambrozo" },
      { id: "alexandria__bab_sharq", ar: "باب شرق", en: "Bab Sharq" },
      { id: "alexandria__bourj_alarab", ar: "برج العرب", en: "Bourj Alarab" },
      { id: "alexandria__stanley", ar: "ستانلى", en: "Stanley" },
      { id: "alexandria__smouha", ar: "سموحة", en: "Smouha" },
      { id: "alexandria__sidi_bishr", ar: "سيدى بشر", en: "Sidi Bishr" },
      { id: "alexandria__shads", ar: "شدس", en: "Shads" },
      { id: "alexandria__gheet_alenab", ar: "غيط العنب", en: "Gheet Alenab" },
      { id: "alexandria__fleming", ar: "فلمينج", en: "Fleming" },
      { id: "alexandria__victoria", ar: "فيكتوريا", en: "Victoria" },
      { id: "alexandria__camp_shizar", ar: "كامب شيزار", en: "Camp Shizar" },
      { id: "alexandria__karmooz", ar: "كرموز", en: "Karmooz" },
      { id: "alexandria__mahta_alraml", ar: "محطة الرمل", en: "Mahta Alraml" },
      { id: "alexandria__mina_elbasal", ar: "مينا البصل", en: "Mina El-Basal" },
      { id: "alexandria__asafra", ar: "العصافرة", en: "Asafra" },
      { id: "alexandria__agamy", ar: "العجمي", en: "Agamy" },
      { id: "alexandria__bakos", ar: "بكوس", en: "Bakos" },
      { id: "alexandria__boulkly", ar: "بولكلي", en: "Boulkly" },
      { id: "alexandria__cleopatra", ar: "كليوباترا", en: "Cleopatra" },
      { id: "alexandria__glim", ar: "جليم", en: "Glim" },
      { id: "alexandria__al_mamurah", ar: "المعمورة", en: "Al Mamurah" },
      { id: "alexandria__al_mandara", ar: "المندرة", en: "Al Mandara" },
      { id: "alexandria__moharam_bek", ar: "محرم بك", en: "Moharam Bek" },
      { id: "alexandria__elshatby", ar: "الشاطبي", en: "Elshatby" },
      { id: "alexandria__sidi_gaber", ar: "سيدي جابر", en: "Sidi Gaber" },
      { id: "alexandria__north_coastsahel", ar: "الساحل الشمالي", en: "North Coast/sahel" },
      { id: "alexandria__alhadra", ar: "الحضرة", en: "Alhadra" },
      { id: "alexandria__alattarin", ar: "العطارين", en: "Alattarin" },
      { id: "alexandria__sidi_kerir", ar: "سيدي كرير", en: "Sidi Kerir" },
      { id: "alexandria__elgomrok", ar: "الجمرك", en: "Elgomrok" },
      { id: "alexandria__al_max", ar: "المكس", en: "Al Max" },
      { id: "alexandria__marina", ar: "مارينا", en: "Marina" },
    ],
  },
  {
    id: "dakahlia",
    ar: "الدقهلية",
    en: "Dakahlia",
    areas: [
      { id: "dakahlia__mansoura", ar: "المنصورة", en: "Mansoura" },
      { id: "dakahlia__talkha", ar: "طلخا", en: "Talkha" },
      { id: "dakahlia__mitt_ghamr", ar: "ميت غمر", en: "Mitt Ghamr" },
      { id: "dakahlia__dekernes", ar: "دكرنس", en: "Dekernes" },
      { id: "dakahlia__aga", ar: "أجا", en: "Aga" },
      { id: "dakahlia__menia_el_nasr", ar: "منية النصر", en: "Menia El Nasr" },
      { id: "dakahlia__sinbillawin", ar: "السنبلاوين", en: "Sinbillawin" },
      { id: "dakahlia__el_kurdi", ar: "الكردي", en: "El Kurdi" },
      { id: "dakahlia__bani_ubaid", ar: "بني عبيد", en: "Bani Ubaid" },
      { id: "dakahlia__al_manzala", ar: "المنزلة", en: "Al Manzala" },
      { id: "dakahlia__tami_alamdid", ar: "تمي الأمديد", en: "tami al'amdid" },
      { id: "dakahlia__aljamalia", ar: "الجمالية", en: "aljamalia" },
      { id: "dakahlia__sherbin", ar: "شربين", en: "Sherbin" },
      { id: "dakahlia__mataria", ar: "المطرية", en: "Mataria" },
      { id: "dakahlia__belqas", ar: "بلقاس", en: "Belqas" },
      { id: "dakahlia__meet_salsil", ar: "ميت سلسيل", en: "Meet Salsil" },
      { id: "dakahlia__gamasa", ar: "جمصة", en: "Gamasa" },
      { id: "dakahlia__mahalat_damana", ar: "محلة دمنة", en: "Mahalat Damana" },
      { id: "dakahlia__nabroh", ar: "نبروه", en: "Nabroh" },
    ],
  },
  {
    id: "red_sea",
    ar: "البحر الأحمر",
    en: "Red Sea",
    areas: [
      { id: "red_sea__hurghada", ar: "الغردقة", en: "Hurghada" },
      { id: "red_sea__ras_ghareb", ar: "رأس غارب", en: "Ras Ghareb" },
      { id: "red_sea__safaga", ar: "سفاجا", en: "Safaga" },
      { id: "red_sea__el_qusiar", ar: "القصير", en: "El Qusiar" },
      { id: "red_sea__marsa_alam", ar: "مرسى علم", en: "Marsa Alam" },
      { id: "red_sea__shalatin", ar: "الشلاتين", en: "Shalatin" },
      { id: "red_sea__halaib", ar: "حلايب", en: "Halaib" },
      { id: "red_sea__aldahar", ar: "الدهار", en: "Aldahar" },
    ],
  },
  {
    id: "beheira",
    ar: "البحيرة",
    en: "Beheira",
    areas: [
      { id: "beheira__damanhour", ar: "دمنهور", en: "Damanhour" },
      { id: "beheira__kafr_el_dawar", ar: "كفر الدوار", en: "Kafr El Dawar" },
      { id: "beheira__rashid", ar: "رشيد", en: "Rashid" },
      { id: "beheira__edco", ar: "إدكو", en: "Edco" },
      { id: "beheira__abu_almatamir", ar: "أبو المطامير", en: "Abu al-Matamir" },
      { id: "beheira__abu_homs", ar: "أبو حمص", en: "Abu Homs" },
      { id: "beheira__delengat", ar: "الدلنجات", en: "Delengat" },
      { id: "beheira__mahmoudiyah", ar: "المحمودية", en: "Mahmoudiyah" },
      { id: "beheira__rahmaniyah", ar: "الرحمانية", en: "Rahmaniyah" },
      { id: "beheira__itai_baroud", ar: "إيتاي البارود", en: "Itai Baroud" },
      { id: "beheira__housh_eissa", ar: "حوش عيسى", en: "Housh Eissa" },
      { id: "beheira__shubrakhit", ar: "شبراخيت", en: "Shubrakhit" },
      { id: "beheira__kom_hamada", ar: "كوم حمادة", en: "Kom Hamada" },
      { id: "beheira__badr", ar: "بدر", en: "Badr" },
      { id: "beheira__wadi_natrun", ar: "وادي النطرون", en: "Wadi Natrun" },
      { id: "beheira__new_nubaria", ar: "النوبارية الجديدة", en: "New Nubaria" },
      { id: "beheira__alnoubareya", ar: "النوبارية", en: "Alnoubareya" },
    ],
  },
  {
    id: "fayoum",
    ar: "الفيوم",
    en: "Fayoum",
    areas: [
      { id: "fayoum__fayoum", ar: "الفيوم", en: "Fayoum" },
      { id: "fayoum__fayoum_el_gedida", ar: "الفيوم الجديدة", en: "Fayoum El Gedida" },
      { id: "fayoum__tamiya", ar: "طامية", en: "Tamiya" },
      { id: "fayoum__snores", ar: "سنورس", en: "Snores" },
      { id: "fayoum__etsa", ar: "إطسا", en: "Etsa" },
      { id: "fayoum__epschway", ar: "إبشواي", en: "Epschway" },
      { id: "fayoum__yusuf_el_sediaq", ar: "يوسف الصديق", en: "Yusuf El Sediaq" },
      { id: "fayoum__hadqa", ar: "الحادقة", en: "Hadqa" },
      { id: "fayoum__atsa", ar: "اطسا", en: "Atsa" },
      { id: "fayoum__algamaa", ar: "الجامعة", en: "Algamaa" },
      { id: "fayoum__sayala", ar: "السيالة", en: "Sayala" },
    ],
  },
  {
    id: "gharbiya",
    ar: "الغربية",
    en: "Gharbiya",
    areas: [
      { id: "gharbiya__tanta", ar: "طنطا", en: "Tanta" },
      { id: "gharbiya__al_mahalla_al_kobra", ar: "المحلة الكبرى", en: "Al Mahalla Al Kobra" },
      { id: "gharbiya__kafr_el_zayat", ar: "كفر الزيات", en: "Kafr El Zayat" },
      { id: "gharbiya__zefta", ar: "زفتى", en: "Zefta" },
      { id: "gharbiya__el_santa", ar: "السنطة", en: "El Santa" },
      { id: "gharbiya__qutour", ar: "قطور", en: "Qutour" },
      { id: "gharbiya__basion", ar: "بسيون", en: "Basion" },
      { id: "gharbiya__samannoud", ar: "سمنود", en: "Samannoud" },
    ],
  },
  {
    id: "ismailia",
    ar: "الإسماعلية",
    en: "Ismailia",
    areas: [
      { id: "ismailia__ismailia", ar: "الإسماعيلية", en: "Ismailia" },
      { id: "ismailia__fayed", ar: "فايد", en: "Fayed" },
      { id: "ismailia__qantara_sharq", ar: "القنطرة شرق", en: "Qantara Sharq" },
      { id: "ismailia__qantara_gharb", ar: "القنطرة غرب", en: "Qantara Gharb" },
      { id: "ismailia__el_tal_el_kabier", ar: "التل الكبير", en: "El Tal El Kabier" },
      { id: "ismailia__abu_sawir", ar: "أبو صوير", en: "Abu Sawir" },
      { id: "ismailia__kasasien_el_gedida", ar: "القصاصين الجديدة", en: "Kasasien El Gedida" },
      { id: "ismailia__nefesha", ar: "نفيشة", en: "Nefesha" },
      { id: "ismailia__sheikh_zayed", ar: "الشيخ زايد", en: "Sheikh Zayed" },
    ],
  },
  {
    id: "menofia",
    ar: "المنوفية",
    en: "Menofia",
    areas: [
      { id: "menofia__shbeen_el_koom", ar: "شبين الكوم", en: "Shbeen El Koom" },
      { id: "menofia__sadat_city", ar: "مدينة السادات", en: "Sadat City" },
      { id: "menofia__menouf", ar: "منوف", en: "Menouf" },
      { id: "menofia__sars_ellayan", ar: "سرس الليان", en: "Sars El-Layan" },
      { id: "menofia__ashmon", ar: "أشمون", en: "Ashmon" },
      { id: "menofia__al_bagor", ar: "الباجور", en: "Al Bagor" },
      { id: "menofia__quesna", ar: "قويسنا", en: "Quesna" },
      { id: "menofia__berkat_el_saba", ar: "بركة السبع", en: "Berkat El Saba" },
      { id: "menofia__tala", ar: "تلا", en: "Tala" },
      { id: "menofia__al_shohada", ar: "الشهداء", en: "Al Shohada" },
    ],
  },
  {
    id: "minya",
    ar: "المنيا",
    en: "Minya",
    areas: [
      { id: "minya__minya", ar: "المنيا", en: "Minya" },
      { id: "minya__minya_el_gedida", ar: "المنيا الجديدة", en: "Minya El Gedida" },
      { id: "minya__el_adwa", ar: "العدوة", en: "El Adwa" },
      { id: "minya__magagha", ar: "مغاغة", en: "Magagha" },
      { id: "minya__bani_mazar", ar: "بني مزار", en: "Bani Mazar" },
      { id: "minya__mattay", ar: "مطاي", en: "Mattay" },
      { id: "minya__samalut", ar: "سمالوط", en: "Samalut" },
      { id: "minya__madinat_el_fekria", ar: "المدينة الفكرية", en: "Madinat El Fekria" },
      { id: "minya__meloy", ar: "ملوي", en: "Meloy" },
      { id: "minya__deir_mawas", ar: "دير مواس", en: "Deir Mawas" },
      { id: "minya__abu_qurqas", ar: "ابو قرقاص", en: "Abu Qurqas" },
      { id: "minya__ard_sultan", ar: "ارض سلطان", en: "Ard Sultan" },
    ],
  },
  {
    id: "qaliubiya",
    ar: "القليوبية",
    en: "Qaliubiya",
    areas: [
      { id: "qaliubiya__banha", ar: "بنها", en: "Banha" },
      { id: "qaliubiya__qalyub", ar: "قليوب", en: "Qalyub" },
      { id: "qaliubiya__shubra_al_khaimah", ar: "شبرا الخيمة", en: "Shubra Al Khaimah" },
      { id: "qaliubiya__al_qanater_charity", ar: "القناطر الخيرية", en: "Al Qanater Charity" },
      { id: "qaliubiya__khanka", ar: "الخانكة", en: "Khanka" },
      { id: "qaliubiya__kafr_shukr", ar: "كفر شكر", en: "Kafr Shukr" },
      { id: "qaliubiya__tukh", ar: "طوخ", en: "Tukh" },
      { id: "qaliubiya__qaha", ar: "قها", en: "Qaha" },
      { id: "qaliubiya__obour", ar: "العبور", en: "Obour" },
      { id: "qaliubiya__khosous", ar: "الخصوص", en: "Khosous" },
      { id: "qaliubiya__shibin_al_qanater", ar: "شبين القناطر", en: "Shibin Al Qanater" },
      { id: "qaliubiya__mostorod", ar: "مسطرد", en: "Mostorod" },
    ],
  },
  {
    id: "new_valley",
    ar: "الوادي الجديد",
    en: "New Valley",
    areas: [
      { id: "new_valley__el_kharga", ar: "الخارجة", en: "El Kharga" },
      { id: "new_valley__paris", ar: "باريس", en: "Paris" },
      { id: "new_valley__mout", ar: "موط", en: "Mout" },
      { id: "new_valley__farafra", ar: "الفرافرة", en: "Farafra" },
      { id: "new_valley__balat", ar: "بلاط", en: "Balat" },
      { id: "new_valley__dakhla", ar: "الداخلة", en: "Dakhla" },
    ],
  },
  {
    id: "suez",
    ar: "السويس",
    en: "Suez",
    areas: [
      { id: "suez__suez", ar: "السويس", en: "Suez" },
      { id: "suez__alganayen", ar: "الجناين", en: "Alganayen" },
      { id: "suez__ataqah", ar: "عتاقة", en: "Ataqah" },
      { id: "suez__ain_sokhna", ar: "العين السخنة", en: "Ain Sokhna" },
      { id: "suez__faysal", ar: "فيصل", en: "Faysal" },
    ],
  },
  {
    id: "aswan",
    ar: "اسوان",
    en: "Aswan",
    areas: [
      { id: "aswan__aswan", ar: "أسوان", en: "Aswan" },
      { id: "aswan__aswan_el_gedida", ar: "أسوان الجديدة", en: "Aswan El Gedida" },
      { id: "aswan__drau", ar: "دراو", en: "Drau" },
      { id: "aswan__kom_ombo", ar: "كوم أمبو", en: "Kom Ombo" },
      { id: "aswan__nasr_al_nuba", ar: "نصر النوبة", en: "Nasr Al Nuba" },
      { id: "aswan__kalabsha", ar: "كلابشة", en: "Kalabsha" },
      { id: "aswan__edfu", ar: "إدفو", en: "Edfu" },
      { id: "aswan__alradisiyah", ar: "الرديسية", en: "Al-Radisiyah" },
      { id: "aswan__al_basilia", ar: "البصيلية", en: "Al Basilia" },
      { id: "aswan__al_sibaeia", ar: "السباعية", en: "Al Sibaeia" },
      { id: "aswan__abo_simbl_al_siyahia", ar: "ابوسمبل السياحية", en: "Abo Simbl Al Siyahia" },
      { id: "aswan__marsa_alam", ar: "مرسى علم", en: "Marsa Alam" },
    ],
  },
  {
    id: "assiut",
    ar: "اسيوط",
    en: "Assiut",
    areas: [
      { id: "assiut__assiut", ar: "أسيوط", en: "Assiut" },
      { id: "assiut__assiut_el_gedida", ar: "أسيوط الجديدة", en: "Assiut El Gedida" },
      { id: "assiut__dayrout", ar: "ديروط", en: "Dayrout" },
      { id: "assiut__manfalut", ar: "منفلوط", en: "Manfalut" },
      { id: "assiut__qusiya", ar: "القوصية", en: "Qusiya" },
      { id: "assiut__abnoub", ar: "أبنوب", en: "Abnoub" },
      { id: "assiut__abu_tig", ar: "أبو تيج", en: "Abu Tig" },
      { id: "assiut__el_ghanaim", ar: "الغنايم", en: "El Ghanaim" },
      { id: "assiut__sahel_selim", ar: "ساحل سليم", en: "Sahel Selim" },
      { id: "assiut__el_badari", ar: "البداري", en: "El Badari" },
      { id: "assiut__sidfa", ar: "صدفا", en: "Sidfa" },
    ],
  },
  {
    id: "beni_suef",
    ar: "بني سويف",
    en: "Beni Suef",
    areas: [
      { id: "beni_suef__bani_sweif", ar: "بني سويف", en: "Bani Sweif" },
      { id: "beni_suef__beni_suef_el_gedida", ar: "بني سويف الجديدة", en: "Beni Suef El Gedida" },
      { id: "beni_suef__al_wasta", ar: "الواسطى", en: "Al Wasta" },
      { id: "beni_suef__naser", ar: "ناصر", en: "Naser" },
      { id: "beni_suef__ehnasia", ar: "إهناسيا", en: "Ehnasia" },
      { id: "beni_suef__beba", ar: "ببا", en: "beba" },
      { id: "beni_suef__fashn", ar: "الفشن", en: "Fashn" },
      { id: "beni_suef__somasta", ar: "سمسطا", en: "Somasta" },
      { id: "beni_suef__alabbaseri", ar: "الاباصيرى", en: "Alabbaseri" },
      { id: "beni_suef__mokbel", ar: "مقبل", en: "Mokbel" },
    ],
  },
  {
    id: "port_said",
    ar: "بورسعيد",
    en: "Port Said",
    areas: [
      { id: "port_said__porsaid", ar: "بورسعيد", en: "PorSaid" },
      { id: "port_said__port_fouad", ar: "بورفؤاد", en: "Port Fouad" },
      { id: "port_said__alarab", ar: "العرب", en: "Alarab" },
      { id: "port_said__zohour", ar: "حى الزهور", en: "Zohour" },
      { id: "port_said__alsharq", ar: "حى الشرق", en: "Alsharq" },
      { id: "port_said__aldawahi", ar: "حى الضواحى", en: "Aldawahi" },
      { id: "port_said__almanakh", ar: "حى المناخ", en: "Almanakh" },
      { id: "port_said__mubarak", ar: "حى مبارك", en: "Mubarak" },
    ],
  },
  {
    id: "damietta",
    ar: "دمياط",
    en: "Damietta",
    areas: [
      { id: "damietta__damietta", ar: "دمياط", en: "Damietta" },
      { id: "damietta__new_damietta", ar: "دمياط الجديدة", en: "New Damietta" },
      { id: "damietta__ras_el_bar", ar: "رأس البر", en: "Ras El Bar" },
      { id: "damietta__faraskour", ar: "فارسكور", en: "Faraskour" },
      { id: "damietta__zarqa", ar: "الزرقا", en: "Zarqa" },
      { id: "damietta__alsaru", ar: "السرو", en: "alsaru" },
      { id: "damietta__alruwda", ar: "الروضة", en: "alruwda" },
      { id: "damietta__kafr_elbatikh", ar: "كفر البطيخ", en: "Kafr El-Batikh" },
      { id: "damietta__azbet_al_burg", ar: "عزبة البرج", en: "Azbet Al Burg" },
      { id: "damietta__meet_abou_ghalib", ar: "ميت أبو غالب", en: "Meet Abou Ghalib" },
      { id: "damietta__kafr_saad", ar: "كفر سعد", en: "Kafr Saad" },
    ],
  },
  {
    id: "sharkia",
    ar: "الشرقية",
    en: "Sharkia",
    areas: [
      { id: "sharkia__zagazig", ar: "الزقازيق", en: "Zagazig" },
      { id: "sharkia__al_ashr_men_ramadan", ar: "العاشر من رمضان", en: "Al Ashr Men Ramadan" },
      { id: "sharkia__minya_al_qamh", ar: "منيا القمح", en: "Minya Al Qamh" },
      { id: "sharkia__belbeis", ar: "بلبيس", en: "Belbeis" },
      { id: "sharkia__mashtoul_el_souq", ar: "مشتول السوق", en: "Mashtoul El Souq" },
      { id: "sharkia__qenaiat", ar: "القنايات", en: "Qenaiat" },
      { id: "sharkia__abu_hammad", ar: "أبو حماد", en: "Abu Hammad" },
      { id: "sharkia__el_qurain", ar: "القرين", en: "El Qurain" },
      { id: "sharkia__hehia", ar: "ههيا", en: "Hehia" },
      { id: "sharkia__abu_kabir", ar: "أبو كبير", en: "Abu Kabir" },
      { id: "sharkia__faccus", ar: "فاقوس", en: "Faccus" },
      { id: "sharkia__el_salihia_el_gedida", ar: "الصالحية الجديدة", en: "El Salihia El Gedida" },
      { id: "sharkia__al_ibrahimiyah", ar: "الإبراهيمية", en: "Al Ibrahimiyah" },
      { id: "sharkia__deirb_negm", ar: "ديرب نجم", en: "Deirb Negm" },
      { id: "sharkia__kafr_saqr", ar: "كفر صقر", en: "Kafr Saqr" },
      { id: "sharkia__awlad_saqr", ar: "أولاد صقر", en: "Awlad Saqr" },
      { id: "sharkia__husseiniya", ar: "الحسينية", en: "Husseiniya" },
      { id: "sharkia__san_alhajar_alqablia", ar: "صان الحجر القبلية", en: "san alhajar alqablia" },
      { id: "sharkia__manshayat_abu_omar", ar: "منشأة أبو عمر", en: "Manshayat Abu Omar" },
    ],
  },
  {
    id: "south_sinai",
    ar: "جنوب سيناء",
    en: "South Sinai",
    areas: [
      { id: "south_sinai__al_toor", ar: "الطور", en: "Al Toor" },
      { id: "south_sinai__sharm_elshaikh", ar: "شرم الشيخ", en: "Sharm El-Shaikh" },
      { id: "south_sinai__dahab", ar: "دهب", en: "Dahab" },
      { id: "south_sinai__nuweiba", ar: "نويبع", en: "Nuweiba" },
      { id: "south_sinai__taba", ar: "طابا", en: "Taba" },
      { id: "south_sinai__saint_catherine", ar: "سانت كاترين", en: "Saint Catherine" },
      { id: "south_sinai__abu_redis", ar: "أبو رديس", en: "Abu Redis" },
      { id: "south_sinai__abu_zenaima", ar: "أبو زنيمة", en: "Abu Zenaima" },
      { id: "south_sinai__ras_sidr", ar: "رأس سدر", en: "Ras Sidr" },
    ],
  },
  {
    id: "kafr_al_sheikh",
    ar: "كفر الشيخ",
    en: "Kafr Al sheikh",
    areas: [
      { id: "kafr_al_sheikh__kafr_el_sheikh", ar: "كفر الشيخ", en: "Kafr El Sheikh" },
      { id: "kafr_al_sheikh__kafr_el_sheikh_downtown", ar: "وسط البلد كفر الشيخ", en: "Kafr El Sheikh Downtown" },
      { id: "kafr_al_sheikh__desouq", ar: "دسوق", en: "Desouq" },
      { id: "kafr_al_sheikh__fooh", ar: "فوه", en: "Fooh" },
      { id: "kafr_al_sheikh__metobas", ar: "مطوبس", en: "Metobas" },
      { id: "kafr_al_sheikh__burg_al_burullus", ar: "برج البرلس", en: "Burg Al Burullus" },
      { id: "kafr_al_sheikh__baltim", ar: "بلطيم", en: "Baltim" },
      { id: "kafr_al_sheikh__masief_baltim", ar: "مصيف بلطيم", en: "Masief Baltim" },
      { id: "kafr_al_sheikh__hamol", ar: "الحامول", en: "Hamol" },
      { id: "kafr_al_sheikh__bella", ar: "بيلا", en: "Bella" },
      { id: "kafr_al_sheikh__riyadh", ar: "الرياض", en: "Riyadh" },
      { id: "kafr_al_sheikh__sidi_salm", ar: "سيدي سالم", en: "Sidi Salm" },
      { id: "kafr_al_sheikh__qellen", ar: "قلين", en: "Qellen" },
      { id: "kafr_al_sheikh__sidi_ghazi", ar: "سيدي غازي", en: "Sidi Ghazi" },
    ],
  },
  {
    id: "matrouh",
    ar: "مطروح",
    en: "Matrouh",
    areas: [
      { id: "matrouh__marsa_matrouh", ar: "مرسى مطروح", en: "Marsa Matrouh" },
      { id: "matrouh__el_hamam", ar: "الحمام", en: "El Hamam" },
      { id: "matrouh__alamein", ar: "العلمين", en: "Alamein" },
      { id: "matrouh__dabaa", ar: "الضبعة", en: "Dabaa" },
      { id: "matrouh__alnagila", ar: "النجيلة", en: "Al-Nagila" },
      { id: "matrouh__sidi_brani", ar: "سيدي براني", en: "Sidi Brani" },
      { id: "matrouh__salloum", ar: "السلوم", en: "Salloum" },
      { id: "matrouh__siwa", ar: "سيوة", en: "Siwa" },
      { id: "matrouh__marina", ar: "مارينا", en: "Marina" },
      { id: "matrouh__north_coast", ar: "الساحل الشمالى", en: "North Coast" },
    ],
  },
  {
    id: "luxor",
    ar: "الأقصر",
    en: "Luxor",
    areas: [
      { id: "luxor__luxor", ar: "الأقصر", en: "Luxor" },
      { id: "luxor__new_luxor", ar: "الأقصر الجديدة", en: "New Luxor" },
      { id: "luxor__esna", ar: "إسنا", en: "Esna" },
      { id: "luxor__new_tiba", ar: "طيبة الجديدة", en: "New Tiba" },
      { id: "luxor__al_ziynia", ar: "الزينية", en: "Al ziynia" },
      { id: "luxor__al_bayadieh", ar: "البياضية", en: "Al Bayadieh" },
      { id: "luxor__al_qarna", ar: "القرنة", en: "Al Qarna" },
      { id: "luxor__armant", ar: "أرمنت", en: "Armant" },
      { id: "luxor__al_tud", ar: "الطود", en: "Al Tud" },
    ],
  },
  {
    id: "qena",
    ar: "قنا",
    en: "Qena",
    areas: [
      { id: "qena__qena", ar: "قنا", en: "Qena" },
      { id: "qena__new_qena", ar: "قنا الجديدة", en: "New Qena" },
      { id: "qena__abu_tesht", ar: "ابو طشت", en: "Abu Tesht" },
      { id: "qena__nag_hammadi", ar: "نجع حمادي", en: "Nag Hammadi" },
      { id: "qena__deshna", ar: "دشنا", en: "Deshna" },
      { id: "qena__alwaqf", ar: "الوقف", en: "Alwaqf" },
      { id: "qena__qaft", ar: "قفط", en: "Qaft" },
      { id: "qena__naqada", ar: "نقادة", en: "Naqada" },
      { id: "qena__farshout", ar: "فرشوط", en: "Farshout" },
      { id: "qena__quos", ar: "قوص", en: "Quos" },
    ],
  },
  {
    id: "north_sinai",
    ar: "شمال سيناء",
    en: "North Sinai",
    areas: [
      { id: "north_sinai__arish", ar: "العريش", en: "Arish" },
      { id: "north_sinai__sheikh_zowaid", ar: "الشيخ زويد", en: "Sheikh Zowaid" },
      { id: "north_sinai__nakhl", ar: "نخل", en: "Nakhl" },
      { id: "north_sinai__rafah", ar: "رفح", en: "Rafah" },
      { id: "north_sinai__bir_alabed", ar: "بئر العبد", en: "Bir al-Abed" },
      { id: "north_sinai__al_hasana", ar: "الحسنة", en: "Al Hasana" },
    ],
  },
  {
    id: "sohag",
    ar: "سوهاج",
    en: "Sohag",
    areas: [
      { id: "sohag__sohag", ar: "سوهاج", en: "Sohag" },
      { id: "sohag__sohag_el_gedida", ar: "سوهاج الجديدة", en: "Sohag El Gedida" },
      { id: "sohag__akhmeem", ar: "أخميم", en: "Akhmeem" },
      { id: "sohag__akhmim_el_gedida", ar: "أخميم الجديدة", en: "Akhmim El Gedida" },
      { id: "sohag__albalina", ar: "البلينا", en: "Albalina" },
      { id: "sohag__el_maragha", ar: "المراغة", en: "El Maragha" },
      { id: "sohag__almunshaa", ar: "المنشأة", en: "almunsha'a" },
      { id: "sohag__dar_aisalaam", ar: "دار السلام", en: "Dar AISalaam" },
      { id: "sohag__gerga", ar: "جرجا", en: "Gerga" },
      { id: "sohag__jahina_al_gharbia", ar: "جهينة الغربية", en: "Jahina Al Gharbia" },
      { id: "sohag__saqilatuh", ar: "ساقلته", en: "Saqilatuh" },
      { id: "sohag__tama", ar: "طما", en: "Tama" },
      { id: "sohag__tahta", ar: "طهطا", en: "Tahta" },
      { id: "sohag__alkawthar", ar: "الكوثر", en: "Alkawthar" },
    ],
  },
];

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM locations WHERE type = 'neighborhood'`);

    const currentIds = new Set(
      EGYPT_LOCATIONS.flatMap((g) => [
        g.id,
        ...g.areas.map((a) => a.id),
      ])
    );

    const { rows: stale } = await client.query(
      `SELECT id FROM locations WHERE type IN ('governorate', 'area')`
    );
    const staleIds = stale.map((r: { id: string }) => r.id).filter((id: string) => !currentIds.has(id));
    if (staleIds.length > 0) {
      await client.query(
        `DELETE FROM locations WHERE id = ANY($1::text[])`,
        [staleIds]
      );
    }

    let govCount = 0;
    let areaCount = 0;

    for (const gov of EGYPT_LOCATIONS) {
      await client.query(
        `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
         VALUES ($1, 'governorate', $2, $3, NULL, $4)
         ON CONFLICT (id) DO UPDATE
           SET type      = 'governorate',
               name_ar   = EXCLUDED.name_ar,
               name_en   = EXCLUDED.name_en,
               slug      = EXCLUDED.slug,
               parent_id = NULL`,
        [gov.id, gov.ar, gov.en, gov.id],
      );
      govCount++;

      for (const area of gov.areas ?? []) {
        await client.query(
          `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
           VALUES ($1, 'area', $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE
             SET type      = 'area',
                 name_ar   = EXCLUDED.name_ar,
                 name_en   = EXCLUDED.name_en,
                 parent_id = EXCLUDED.parent_id,
                 slug      = EXCLUDED.slug`,
          [area.id, area.ar, area.en, gov.id, area.id],
        );
        areaCount++;
      }
    }

    await client.query("COMMIT");
    console.log(
      `Reseeded: ${govCount} governorates, ${areaCount} areas. ` +
      `Removed ${staleIds.length} stale legacy rows and all neighborhood rows.`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
