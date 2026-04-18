/**
 * Egyptian governorates, areas, and neighborhoods data
 * Sourced from Google Maps / official Egyptian administrative divisions
 * Focus on Alexandria with full neighborhood detail
 */

export interface Neighborhood {
  id: string;
  ar: string;
  en: string;
}

export interface Area {
  id: string;
  ar: string;
  en: string;
  neighborhoods: Neighborhood[];
}

export interface Governorate {
  id: string;
  ar: string;
  en: string;
  areas: Area[];
}

export const EGYPT_LOCATIONS: Governorate[] = [
  // ─── الإسكندرية — Alexandria (detailed) ─────────────────────────────────
  {
    id: "alexandria",
    ar: "الإسكندرية",
    en: "Alexandria",
    areas: [
      {
        id: "alex_east",
        ar: "حي شرق",
        en: "Al Sharq District",
        neighborhoods: [
          { id: "ramla",        ar: "محطة الرمل",    en: "Ramla Station"   },
          { id: "al_ramla",     ar: "الرمل",          en: "Al Ramla"        },
          { id: "fleming",      ar: "فلمنج",          en: "Fleming"         },
          { id: "sporting",     ar: "سبورتنج",        en: "Sporting"        },
          { id: "ibrahimia",    ar: "الإبراهيمية",    en: "Ibrahimia"       },
          { id: "shatby",       ar: "الشاطبي",        en: "Shatby"          },
          { id: "bab_sharq",    ar: "باب شرق",        en: "Bab Al Sharq"    },
          { id: "louran",       ar: "لوران",          en: "Louran"          },
          { id: "rush_d",       ar: "رشدي",           en: "Rushdy"          },
          { id: "gleem",        ar: "جليم",           en: "Gleem"           },
          { id: "san_stefano",  ar: "سان ستيفانو",    en: "San Stefano"     },
          { id: "kafr_abdou",   ar: "كفر عبدو",       en: "Kafr Abdou"      },
          { id: "zizinia",      ar: "زيزينيا",        en: "Zizinia"         },
          { id: "bolkly",       ar: "بولكلي",         en: "Bolkly"          },
          { id: "smouha",       ar: "سموحة",          en: "Smouha"          },
          { id: "victoria",     ar: "فيكتوريا",       en: "Victoria"        },
        ],
      },
      {
        id: "alex_montaza",
        ar: "حي المنتزه",
        en: "Al Montaza District",
        neighborhoods: [
          { id: "sidi_bishr",   ar: "سيدي بشر",       en: "Sidi Bishr"      },
          { id: "miami",        ar: "ميامي",           en: "Miami"           },
          { id: "mandara",      ar: "المندرة",         en: "Al Mandara"      },
          { id: "asafra",       ar: "العصافرة",        en: "Al Asafra"       },
          { id: "montaza",      ar: "المنتزه",         en: "Al Montaza"      },
          { id: "maamoura",     ar: "المعمورة",        en: "Al Maamoura"     },
          { id: "abu_qir",      ar: "أبو قير",         en: "Abu Qir"         },
          { id: "nozha",        ar: "النزهة",          en: "Al Nozha"        },
          { id: "sidi_gaber",   ar: "سيدي جابر",       en: "Sidi Gaber"      },
          { id: "bekos",        ar: "باكوس",           en: "Bakos"           },
          { id: "cleopatra",    ar: "كليوباترا",       en: "Cleopatra"       },
          { id: "loran2",       ar: "سيدي بشر بحري",  en: "Sidi Bishr Bahri"},
        ],
      },
      {
        id: "alex_center",
        ar: "حي وسط",
        en: "Central District",
        neighborhoods: [
          { id: "manshia",      ar: "المنشية",         en: "Al Manshia"      },
          { id: "attarine",     ar: "العطارين",        en: "Al Attarine"     },
          { id: "azarita",      ar: "الأزاريطة",       en: "Al Azarita"      },
          { id: "moharram_bey", ar: "محرم بك",         en: "Moharram Bey"    },
          { id: "mina_basal",   ar: "ميناء البصل",     en: "Mina Al Basal"   },
          { id: "karmus",       ar: "كرموز",           en: "Karmus"          },
          { id: "raas_el_teen", ar: "رأس التين",       en: "Raas El Teen"    },
          { id: "anfushi",      ar: "الأنفوشي",        en: "Al Anfushi"      },
          { id: "laban",        ar: "اللبان",          en: "Al Laban"        },
          { id: "hadara",       ar: "حدائق القبة",     en: "Hadaek Al Qobba" },
        ],
      },
      {
        id: "alex_gomrok",
        ar: "حي الجمرك",
        en: "Al Gomrok District",
        neighborhoods: [
          { id: "gomrok",       ar: "الجمرك",          en: "Al Gomrok"       },
          { id: "mina_shaab",   ar: "المينا الشعبية",  en: "Al Mina Al Shabia"},
          { id: "bahri",        ar: "بحري",            en: "Bahri"           },
          { id: "dekhela",      ar: "الدخيلة",         en: "Al Dekhela"      },
          { id: "mex",          ar: "المكس",           en: "Al Mex"          },
          { id: "wardian",      ar: "ورديان",          en: "Wardian"         },
        ],
      },
      {
        id: "alex_west",
        ar: "حي غرب",
        en: "West Alexandria District",
        neighborhoods: [
          { id: "agami",        ar: "العجمي",          en: "Al Agami"        },
          { id: "hannoville",   ar: "الهانوفيل",       en: "Hannoville"      },
          { id: "amreya",       ar: "العامرية",        en: "Al Amreya"       },
          { id: "borg_arab",    ar: "برج العرب",       en: "Borg Al Arab"    },
          { id: "new_borg",     ar: "برج العرب الجديدة",en: "New Borg Al Arab"},
          { id: "bitash",       ar: "البيطاش",         en: "Al Bitash"       },
          { id: "biyala",       ar: "العجمي الجديدة",  en: "New Agami"       },
        ],
      },
    ],
  },

  // ─── القاهرة — Cairo ─────────────────────────────────────────────────────
  {
    id: "cairo",
    ar: "القاهرة",
    en: "Cairo",
    areas: [
      {
        id: "cairo_east",
        ar: "شرق القاهرة",
        en: "East Cairo",
        neighborhoods: [
          { id: "nasr_city",    ar: "مدينة نصر",      en: "Nasr City"       },
          { id: "heliopolis",   ar: "مصر الجديدة",    en: "Heliopolis"      },
          { id: "zaytoun",      ar: "الزيتون",         en: "Al Zaytoun"      },
          { id: "ain_shams",    ar: "عين شمس",         en: "Ain Shams"       },
          { id: "mataria",      ar: "المطرية",         en: "Al Mataria"      },
          { id: "nozha_c",      ar: "النزهة",          en: "Al Nozha"        },
          { id: "rehab",        ar: "الرحاب",          en: "Al Rehab"        },
          { id: "new_cairo",    ar: "القاهرة الجديدة", en: "New Cairo"       },
          { id: "fifth_settle", ar: "التجمع الخامس",   en: "Fifth Settlement"},
        ],
      },
      {
        id: "cairo_west",
        ar: "غرب القاهرة",
        en: "West Cairo",
        neighborhoods: [
          { id: "dokki",        ar: "الدقي",           en: "Dokki"           },
          { id: "agouza",       ar: "العجوزة",         en: "Agouza"          },
          { id: "mohandessin",  ar: "المهندسين",       en: "Mohandessin"     },
          { id: "imbaba",       ar: "إمبابة",          en: "Imbaba"          },
          { id: "zamalek",      ar: "الزمالك",         en: "Zamalek"         },
        ],
      },
      {
        id: "cairo_south",
        ar: "جنوب القاهرة",
        en: "South Cairo",
        neighborhoods: [
          { id: "maadi",        ar: "المعادي",         en: "Maadi"           },
          { id: "mokattam",     ar: "المقطم",          en: "Al Mokattam"     },
          { id: "basateen",     ar: "البساتين",        en: "Al Basateen"     },
          { id: "helwan",       ar: "حلوان",           en: "Helwan"          },
          { id: "new_helwan",   ar: "حلوان الجديدة",  en: "New Helwan"      },
        ],
      },
      {
        id: "cairo_center",
        ar: "وسط القاهرة",
        en: "Central Cairo",
        neighborhoods: [
          { id: "downtown",     ar: "وسط البلد",       en: "Downtown"        },
          { id: "garden_city",  ar: "جاردن سيتي",      en: "Garden City"     },
          { id: "abdin",        ar: "عابدين",          en: "Abdin"           },
          { id: "sayeda_zeinab",ar: "السيدة زينب",     en: "Sayeda Zeinab"   },
          { id: "bab_el_luq",   ar: "باب اللوق",       en: "Bab El Luq"      },
          { id: "shubra",       ar: "شبرا",            en: "Shubra"          },
        ],
      },
    ],
  },

  // ─── الجيزة — Giza ──────────────────────────────────────────────────────
  {
    id: "giza",
    ar: "الجيزة",
    en: "Giza",
    areas: [
      {
        id: "giza_east",
        ar: "شرق الجيزة",
        en: "East Giza",
        neighborhoods: [
          { id: "haram",        ar: "الهرم",           en: "Al Haram"        },
          { id: "faisal",       ar: "فيصل",            en: "Faisal"          },
          { id: "ard_el_lewa",  ar: "أرض اللواء",      en: "Ard El Lewa"     },
        ],
      },
      {
        id: "oct_6",
        ar: "السادس من أكتوبر",
        en: "6th of October City",
        neighborhoods: [
          { id: "oct_center",   ar: "المدينة",         en: "City Center"     },
          { id: "zayed",        ar: "الشيخ زايد",      en: "Sheikh Zayed"    },
          { id: "hayy_11",      ar: "الحي الحادي عشر", en: "District 11"     },
        ],
      },
    ],
  },

  // ─── القليوبية — Qalyubia ──────────────────────────────────────────────
  {
    id: "qalyubia",
    ar: "القليوبية",
    en: "Qalyubia",
    areas: [
      {
        id: "banha",
        ar: "بنها",
        en: "Banha",
        neighborhoods: [
          { id: "banha_c", ar: "مركز بنها", en: "Banha Center" },
          { id: "tokh",    ar: "طوخ",       en: "Tokh"         },
        ],
      },
      {
        id: "shubra_khima",
        ar: "شبرا الخيمة",
        en: "Shubra Al Kheima",
        neighborhoods: [
          { id: "shubra_c", ar: "وسط شبرا الخيمة", en: "Shubra Al Kheima Center" },
          { id: "qalyub",   ar: "قليوب",           en: "Qalyub"                  },
        ],
      },
    ],
  },

  // ─── الشرقية — Sharqia ─────────────────────────────────────────────────
  {
    id: "sharqia",
    ar: "الشرقية",
    en: "Sharqia",
    areas: [
      {
        id: "zagazig",
        ar: "الزقازيق",
        en: "Zagazig",
        neighborhoods: [
          { id: "zagazig_c", ar: "وسط الزقازيق", en: "Zagazig Center" },
          { id: "belbeis",   ar: "بلبيس",        en: "Belbeis"        },
          { id: "ramadan10", ar: "العاشر من رمضان", en: "10th of Ramadan City" },
        ],
      },
    ],
  },

  // ─── الدقهلية — Dakahlia ──────────────────────────────────────────────
  {
    id: "dakahlia",
    ar: "الدقهلية",
    en: "Dakahlia",
    areas: [
      {
        id: "mansoura",
        ar: "المنصورة",
        en: "Mansoura",
        neighborhoods: [
          { id: "mansoura_c",   ar: "وسط المنصورة", en: "Mansoura Center" },
          { id: "talkha",       ar: "طلخا",         en: "Talkha"          },
          { id: "mit_ghamr",    ar: "ميت غمر",      en: "Mit Ghamr"       },
        ],
      },
    ],
  },

  // ─── الغربية — Gharbia ────────────────────────────────────────────────
  {
    id: "gharbia",
    ar: "الغربية",
    en: "Gharbia",
    areas: [
      {
        id: "tanta",
        ar: "طنطا",
        en: "Tanta",
        neighborhoods: [
          { id: "tanta_c",     ar: "وسط طنطا",        en: "Tanta Center"    },
          { id: "mahalla",     ar: "المحلة الكبرى",   en: "Al Mahalla"      },
          { id: "kafr_zayat",  ar: "كفر الزيات",      en: "Kafr Al Zayat"   },
          { id: "zefta",       ar: "زفتى",            en: "Zefta"           },
        ],
      },
    ],
  },

  // ─── المنوفية — Monufia ──────────────────────────────────────────────
  {
    id: "monufia",
    ar: "المنوفية",
    en: "Monufia",
    areas: [
      {
        id: "shebin",
        ar: "شبين الكوم",
        en: "Shebin Al Kom",
        neighborhoods: [
          { id: "shebin_c", ar: "وسط شبين الكوم", en: "Shebin Center" },
          { id: "menouf",   ar: "منوف",           en: "Menouf"        },
          { id: "ashmoun",  ar: "أشمون",          en: "Ashmoun"       },
        ],
      },
    ],
  },

  // ─── كفر الشيخ — Kafr Al Sheikh ─────────────────────────────────────
  {
    id: "kafr_el_sheikh",
    ar: "كفر الشيخ",
    en: "Kafr Al Sheikh",
    areas: [
      {
        id: "kafr_c",
        ar: "كفر الشيخ",
        en: "Kafr Al Sheikh City",
        neighborhoods: [
          { id: "kafr_center", ar: "وسط المدينة", en: "City Center" },
          { id: "fouh",        ar: "فوه",         en: "Fouh"        },
          { id: "desouk",      ar: "دسوق",        en: "Desouk"      },
          { id: "hamoul",      ar: "الحامول",     en: "Al Hamoul"   },
        ],
      },
    ],
  },

  // ─── البحيرة — Beheira ────────────────────────────────────────────────
  {
    id: "beheira",
    ar: "البحيرة",
    en: "Beheira",
    areas: [
      {
        id: "damanhur",
        ar: "دمنهور",
        en: "Damanhur",
        neighborhoods: [
          { id: "damanhur_c",  ar: "وسط دمنهور",  en: "Damanhur Center" },
          { id: "kom_hamada",  ar: "كوم حمادة",   en: "Kom Hamada"      },
          { id: "abu_homos",   ar: "أبو حمص",     en: "Abu Homos"       },
          { id: "rashid",      ar: "رشيد",        en: "Rashid (Rosetta)"},
        ],
      },
    ],
  },

  // ─── الإسماعيلية — Ismailia ─────────────────────────────────────────
  {
    id: "ismailia",
    ar: "الإسماعيلية",
    en: "Ismailia",
    areas: [
      {
        id: "ismailia_c",
        ar: "الإسماعيلية",
        en: "Ismailia City",
        neighborhoods: [
          { id: "ismailia_center", ar: "وسط الإسماعيلية", en: "Ismailia Center" },
          { id: "abu_sowaer",      ar: "أبو صوير",        en: "Abu Sowaer"      },
          { id: "el_tal",          ar: "التل الكبير",     en: "Al Tal Al Kabir" },
          { id: "fayed",           ar: "فايد",            en: "Fayed"           },
        ],
      },
    ],
  },

  // ─── بور سعيد — Port Said ────────────────────────────────────────────
  {
    id: "port_said",
    ar: "بور سعيد",
    en: "Port Said",
    areas: [
      {
        id: "port_said_c",
        ar: "بور سعيد",
        en: "Port Said City",
        neighborhoods: [
          { id: "port_center",  ar: "وسط البلد",    en: "City Center"     },
          { id: "arab_district",ar: "حي العرب",     en: "Arab District"   },
          { id: "zohoor",       ar: "حي الزهور",    en: "Al Zohour"       },
          { id: "sharq_ps",     ar: "حي الشرق",     en: "Al Sharq"        },
          { id: "dawahy",       ar: "الضواحي",      en: "Al Dawahy"       },
        ],
      },
    ],
  },

  // ─── السويس — Suez ───────────────────────────────────────────────────
  {
    id: "suez",
    ar: "السويس",
    en: "Suez",
    areas: [
      {
        id: "suez_c",
        ar: "السويس",
        en: "Suez City",
        neighborhoods: [
          { id: "suez_center", ar: "وسط السويس",   en: "Suez Center"   },
          { id: "arbaeen",     ar: "الأربعين",     en: "Al Arbaeen"    },
          { id: "suez_ganoub", ar: "جنوب السويس",  en: "South Suez"    },
          { id: "ain_sokhna",  ar: "العين السخنة", en: "Ain Sokhna"    },
        ],
      },
    ],
  },

  // ─── الفيوم — Fayoum ─────────────────────────────────────────────────
  {
    id: "fayoum",
    ar: "الفيوم",
    en: "Fayoum",
    areas: [
      {
        id: "fayoum_c",
        ar: "الفيوم",
        en: "Fayoum City",
        neighborhoods: [
          { id: "fayoum_center", ar: "وسط الفيوم", en: "Fayoum Center" },
          { id: "sinnuris",      ar: "سنورس",      en: "Sinnuris"      },
          { id: "ibshaway",      ar: "إبشواي",     en: "Ibshaway"      },
        ],
      },
    ],
  },

  // ─── بني سويف — Beni Suef ────────────────────────────────────────────
  {
    id: "beni_suef",
    ar: "بني سويف",
    en: "Beni Suef",
    areas: [
      {
        id: "beni_suef_c",
        ar: "بني سويف",
        en: "Beni Suef City",
        neighborhoods: [
          { id: "benisuef_c",   ar: "وسط بني سويف", en: "Beni Suef Center" },
          { id: "el_fashn",     ar: "الفشن",        en: "Al Fashn"         },
          { id: "beba",         ar: "ببا",           en: "Beba"             },
        ],
      },
    ],
  },

  // ─── المنيا — Minya ──────────────────────────────────────────────────
  {
    id: "minya",
    ar: "المنيا",
    en: "Minya",
    areas: [
      {
        id: "minya_c",
        ar: "المنيا",
        en: "Minya City",
        neighborhoods: [
          { id: "minya_center", ar: "وسط المنيا", en: "Minya Center" },
          { id: "mallawi",      ar: "ملوي",       en: "Mallawi"      },
          { id: "sammalout",    ar: "سمالوط",     en: "Sammalout"    },
          { id: "maghagha",     ar: "مغاغة",      en: "Maghagha"     },
        ],
      },
    ],
  },

  // ─── أسيوط — Assiut ──────────────────────────────────────────────────
  {
    id: "assiut",
    ar: "أسيوط",
    en: "Assiut",
    areas: [
      {
        id: "assiut_c",
        ar: "أسيوط",
        en: "Assiut City",
        neighborhoods: [
          { id: "assiut_center", ar: "وسط أسيوط", en: "Assiut Center" },
          { id: "dairout",       ar: "ديروط",     en: "Dairout"       },
          { id: "manfalout",     ar: "منفلوط",    en: "Manfalout"     },
          { id: "abnoub",        ar: "أبنوب",     en: "Abnoub"        },
        ],
      },
    ],
  },

  // ─── سوهاج — Sohag ───────────────────────────────────────────────────
  {
    id: "sohag",
    ar: "سوهاج",
    en: "Sohag",
    areas: [
      {
        id: "sohag_c",
        ar: "سوهاج",
        en: "Sohag City",
        neighborhoods: [
          { id: "sohag_center", ar: "وسط سوهاج", en: "Sohag Center"  },
          { id: "akhmim",       ar: "أخميم",     en: "Akhmim"        },
          { id: "girga",        ar: "جرجا",      en: "Girga"         },
          { id: "tahta",        ar: "طهطا",      en: "Tahta"         },
        ],
      },
    ],
  },

  // ─── قنا — Qena ──────────────────────────────────────────────────────
  {
    id: "qena",
    ar: "قنا",
    en: "Qena",
    areas: [
      {
        id: "qena_c",
        ar: "قنا",
        en: "Qena City",
        neighborhoods: [
          { id: "qena_center",  ar: "وسط قنا",    en: "Qena Center"  },
          { id: "nag_hammadi",  ar: "نجع حمادي",  en: "Nag Hammadi"  },
          { id: "deshna",       ar: "دشنا",       en: "Deshna"       },
        ],
      },
    ],
  },

  // ─── الأقصر — Luxor ──────────────────────────────────────────────────
  {
    id: "luxor",
    ar: "الأقصر",
    en: "Luxor",
    areas: [
      {
        id: "luxor_c",
        ar: "الأقصر",
        en: "Luxor City",
        neighborhoods: [
          { id: "luxor_east",  ar: "الأقصر شرق", en: "Luxor East"  },
          { id: "luxor_west",  ar: "الأقصر غرب", en: "Luxor West"  },
          { id: "esna",        ar: "إسنا",       en: "Esna"        },
          { id: "armant",      ar: "أرمنت",      en: "Armant"      },
        ],
      },
    ],
  },

  // ─── أسوان — Aswan ───────────────────────────────────────────────────
  {
    id: "aswan",
    ar: "أسوان",
    en: "Aswan",
    areas: [
      {
        id: "aswan_c",
        ar: "أسوان",
        en: "Aswan City",
        neighborhoods: [
          { id: "aswan_center", ar: "وسط أسوان",  en: "Aswan Center"  },
          { id: "kom_ombo",     ar: "كوم أمبو",   en: "Kom Ombo"      },
          { id: "edfu",         ar: "إدفو",       en: "Edfu"          },
          { id: "abu_simbel",   ar: "أبو سمبل",   en: "Abu Simbel"    },
        ],
      },
    ],
  },

  // ─── البحر الأحمر — Red Sea ──────────────────────────────────────────
  {
    id: "red_sea",
    ar: "البحر الأحمر",
    en: "Red Sea",
    areas: [
      {
        id: "hurghada",
        ar: "الغردقة",
        en: "Hurghada",
        neighborhoods: [
          { id: "hurghada_c",   ar: "الغردقة",        en: "Hurghada"       },
          { id: "el_gouna",     ar: "الجونة",         en: "El Gouna"       },
          { id: "safaga",       ar: "سفاجا",          en: "Safaga"         },
          { id: "quseir",       ar: "القصير",         en: "Al Quseir"      },
          { id: "marsa_alam",   ar: "مرسى علم",       en: "Marsa Alam"     },
        ],
      },
    ],
  },

  // ─── شمال سيناء — North Sinai ────────────────────────────────────────
  {
    id: "north_sinai",
    ar: "شمال سيناء",
    en: "North Sinai",
    areas: [
      {
        id: "arish",
        ar: "العريش",
        en: "Arish",
        neighborhoods: [
          { id: "arish_c",   ar: "وسط العريش",  en: "Arish Center"  },
          { id: "sheikh_zuweid", ar: "الشيخ زويد", en: "Sheikh Zuweid"},
          { id: "rafah",     ar: "رفح",         en: "Rafah"         },
        ],
      },
    ],
  },

  // ─── جنوب سيناء — South Sinai ────────────────────────────────────────
  {
    id: "south_sinai",
    ar: "جنوب سيناء",
    en: "South Sinai",
    areas: [
      {
        id: "sharm",
        ar: "شرم الشيخ",
        en: "Sharm El Sheikh",
        neighborhoods: [
          { id: "naama_bay",   ar: "خليج نعمة",  en: "Naama Bay"     },
          { id: "hadaba",      ar: "الحدبة",      en: "Al Hadaba"     },
          { id: "soho_sq",     ar: "سوهو سكوير", en: "Soho Square"   },
        ],
      },
      {
        id: "dahab",
        ar: "دهب",
        en: "Dahab",
        neighborhoods: [
          { id: "dahab_c",  ar: "دهب",        en: "Dahab"         },
          { id: "nuweiba",  ar: "نويبع",      en: "Nuweiba"       },
          { id: "taba",     ar: "طابا",       en: "Taba"          },
        ],
      },
    ],
  },

  // ─── مطروح — Matrouh ─────────────────────────────────────────────────
  {
    id: "matrouh",
    ar: "مطروح",
    en: "Matrouh",
    areas: [
      {
        id: "marsa_matrouh",
        ar: "مرسى مطروح",
        en: "Marsa Matrouh",
        neighborhoods: [
          { id: "matrouh_c",  ar: "وسط مطروح",   en: "Matrouh Center" },
          { id: "siwa",       ar: "سيوة",         en: "Siwa Oasis"     },
          { id: "sallum",     ar: "السلوم",       en: "Sallum"         },
        ],
      },
    ],
  },

  // ─── الوادي الجديد — New Valley ──────────────────────────────────────
  {
    id: "new_valley",
    ar: "الوادي الجديد",
    en: "New Valley",
    areas: [
      {
        id: "kharga",
        ar: "الخارجة",
        en: "Al Kharga",
        neighborhoods: [
          { id: "kharga_c",  ar: "مدينة الخارجة", en: "Kharga City"   },
          { id: "dakhla",    ar: "الداخلة",       en: "Dakhla"        },
          { id: "farafra",   ar: "الفرافرة",      en: "Farafra"       },
        ],
      },
    ],
  },

  // ─── دمياط — Damietta ────────────────────────────────────────────────
  {
    id: "damietta",
    ar: "دمياط",
    en: "Damietta",
    areas: [
      {
        id: "damietta_c",
        ar: "دمياط",
        en: "Damietta City",
        neighborhoods: [
          { id: "damietta_center", ar: "وسط دمياط",  en: "Damietta Center" },
          { id: "new_damietta",    ar: "دمياط الجديدة",en: "New Damietta"   },
          { id: "faraskur",        ar: "فارسكور",     en: "Faraskur"        },
          { id: "ras_el_bar",      ar: "رأس البر",    en: "Ras El Bar"      },
        ],
      },
    ],
  },

  // ─── كفر الشيخ — already included above ─────────────────────────────

  // ─── الغربية — already included above ────────────────────────────────
];

/** Returns governorate by id */
export function getGovernorate(govId: string): Governorate | undefined {
  return EGYPT_LOCATIONS.find((g) => g.id === govId);
}

/** Returns areas for a governorate */
export function getAreas(govId: string): Area[] {
  return getGovernorate(govId)?.areas ?? [];
}

/** Returns neighborhoods for an area */
export function getNeighborhoods(govId: string, areaId: string): Neighborhood[] {
  return getAreas(govId).find((a) => a.id === areaId)?.neighborhoods ?? [];
}

/** Default to Alexandria */
export const DEFAULT_GOVERNORATE = "alexandria";
export const DEFAULT_AREA = "alex_east";

/** Map center coordinates for each governorate (lat, lng) */
export const GOV_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
  alexandria: { lat: 31.2001,  lng: 29.9187, zoom: 12 },
  cairo:      { lat: 30.0444,  lng: 31.2357, zoom: 11 },
  giza:       { lat: 30.0131,  lng: 31.2089, zoom: 11 },
  beheira:    { lat: 30.8480,  lng: 30.3375, zoom: 10 },
  gharbia:    { lat: 30.7865,  lng: 31.0000, zoom: 10 },
  monufia:    { lat: 30.5977,  lng: 30.9876, zoom: 10 },
  dakahlia:   { lat: 31.0400,  lng: 31.3800, zoom: 10 },
  sharqia:    { lat: 30.5877,  lng: 31.5021, zoom: 10 },
  qalyubia:   { lat: 30.3317,  lng: 31.2156, zoom: 10 },
  kafr_el_sheikh: { lat: 31.1107, lng: 30.9388, zoom: 10 },
  ismailia:   { lat: 30.5965,  lng: 32.2715, zoom: 10 },
  port_said:  { lat: 31.2653,  lng: 32.3019, zoom: 11 },
  suez:       { lat: 29.9668,  lng: 32.5498, zoom: 11 },
  damietta:   { lat: 31.4165,  lng: 31.8133, zoom: 11 },
  fayoum:     { lat: 29.3084,  lng: 30.8428, zoom: 10 },
  beni_suef:  { lat: 29.0744,  lng: 31.0994, zoom: 10 },
  minya:      { lat: 28.0871,  lng: 30.7618, zoom: 9  },
  assiut:     { lat: 27.1783,  lng: 31.1859, zoom: 10 },
  sohag:      { lat: 26.5590,  lng: 31.6948, zoom: 9  },
  qena:       { lat: 26.1551,  lng: 32.7160, zoom: 9  },
  luxor:      { lat: 25.6872,  lng: 32.6396, zoom: 10 },
  aswan:      { lat: 24.0889,  lng: 32.8998, zoom: 10 },
  red_sea:    { lat: 27.2579,  lng: 33.8116, zoom: 8  },
  north_sinai:{ lat: 30.8650,  lng: 33.6243, zoom: 9  },
  south_sinai:{ lat: 27.9158,  lng: 34.3300, zoom: 9  },
  matrouh:    { lat: 31.3525,  lng: 27.2453, zoom: 8  },
  new_valley: { lat: 25.4464,  lng: 30.5584, zoom: 7  },
};
