/**
 * Ready-to-import cities / governorates per country. Saudi Arabia lists its
 * 13 administrative regions with their governorates (المحافظات); GCC
 * countries list their emirates / governorates. Imported rows become normal
 * editable records (Admin → Settings → Countries & cities).
 */
type T = { en: string; ar: string };
export type RegionPreset = { group: T; cities: T[] };

const c = (en: string, ar: string): T => ({ en, ar });
const g = (en: string, ar: string, cities: [string, string][]): RegionPreset => ({ group: c(en, ar), cities: cities.map(([e, a]) => c(e, a)) });

export const REGION_PRESETS: Record<string, RegionPreset[]> = {
  SA: [
    g("Riyadh Region", "منطقة الرياض", [
      ["Riyadh", "الرياض"], ["Diriyah", "الدرعية"], ["Al Kharj", "الخرج"], ["Ad Dawadmi", "الدوادمي"], ["Al Majma'ah", "المجمعة"], ["Al Quway'iyah", "القويعية"],
      ["Wadi Ad Dawasir", "وادي الدواسر"], ["Al Aflaj", "الأفلاج"], ["Az Zulfi", "الزلفي"], ["Shaqra", "شقراء"], ["Hotat Bani Tamim", "حوطة بني تميم"], ["Afif", "عفيف"],
      ["As Sulayyil", "السليل"], ["Dhurma", "ضرما"], ["Al Muzahmiyya", "المزاحمية"], ["Rimah", "رماح"], ["Thadiq", "ثادق"], ["Huraymila", "حريملاء"],
      ["Al Hariq", "الحريق"], ["Al Ghat", "الغاط"], ["Marat", "مرات"], ["Ad Dilam", "الدلم"], ["Ar Rayn", "الرين"],
    ]),
    g("Makkah Region", "منطقة مكة المكرمة", [
      ["Makkah", "مكة المكرمة"], ["Jeddah", "جدة"], ["Taif", "الطائف"], ["Al Qunfudhah", "القنفذة"], ["Al Lith", "الليث"], ["Rabigh", "رابغ"],
      ["Al Jumum", "الجموم"], ["Khulais", "خليص"], ["Al Kamil", "الكامل"], ["Al Khurmah", "الخرمة"], ["Ranyah", "رنية"], ["Turabah", "تربة"],
      ["Adham", "أضم"], ["Al Muwayh", "الموية"], ["Maysan", "ميسان"], ["Al Ardiyat", "العرضيات"], ["Bahrah", "بحرة"],
    ]),
    g("Madinah Region", "منطقة المدينة المنورة", [
      ["Madinah", "المدينة المنورة"], ["Yanbu", "ينبع"], ["Al Ula", "العلا"], ["Al Mahd", "المهد"], ["Badr", "بدر"], ["Khaybar", "خيبر"],
      ["Al Hanakiyah", "الحناكية"], ["Wadi Al Fara", "وادي الفرع"], ["Al Ais", "العيص"],
    ]),
    g("Qassim Region", "منطقة القصيم", [
      ["Buraydah", "بريدة"], ["Unaizah", "عنيزة"], ["Ar Rass", "الرس"], ["Al Mithnab", "المذنب"], ["Al Bukayriyah", "البكيرية"], ["Al Badaya", "البدائع"],
      ["Al Asyah", "الأسياح"], ["An Nabhaniyah", "النبهانية"], ["Uyun Al Jiwa", "عيون الجواء"], ["Riyadh Al Khabra", "رياض الخبراء"], ["Ash Shimasiyah", "الشماسية"],
      ["Uqlat As Suqur", "عقلة الصقور"], ["Dariyah", "ضرية"],
    ]),
    g("Eastern Province", "المنطقة الشرقية", [
      ["Dammam", "الدمام"], ["Al Khobar", "الخبر"], ["Dhahran", "الظهران"], ["Al Ahsa", "الأحساء"], ["Hafar Al Batin", "حفر الباطن"], ["Al Jubail", "الجبيل"],
      ["Al Qatif", "القطيف"], ["Al Khafji", "الخفجي"], ["Ras Tanura", "رأس تنورة"], ["Abqaiq", "بقيق"], ["An Nairiyah", "النعيرية"], ["Qaryat Al Ulya", "قرية العليا"],
      ["Al Udayd", "العديد"],
    ]),
    g("Asir Region", "منطقة عسير", [
      ["Abha", "أبها"], ["Khamis Mushait", "خميس مشيط"], ["Bisha", "بيشة"], ["An Namas", "النماص"], ["Muhayil Asir", "محايل عسير"], ["Sarat Abidah", "سراة عبيدة"],
      ["Tathlith", "تثليث"], ["Rijal Almaa", "رجال ألمع"], ["Ahad Rufaidah", "أحد رفيدة"], ["Dhahran Al Janub", "ظهران الجنوب"], ["Balqarn", "بلقرن"],
      ["Al Majardah", "المجاردة"], ["Tanomah", "تنومة"], ["Bariq", "بارق"], ["Tareeb", "طريب"], ["Al Birk", "البرك"],
    ]),
    g("Tabuk Region", "منطقة تبوك", [
      ["Tabuk", "تبوك"], ["Al Wajh", "الوجه"], ["Duba", "ضباء"], ["Tayma", "تيماء"], ["Umluj", "أملج"], ["Haql", "حقل"], ["Al Bad", "البدع"],
    ]),
    g("Hail Region", "منطقة حائل", [
      ["Hail", "حائل"], ["Baqaa", "بقعاء"], ["Al Ghazalah", "الغزالة"], ["Ash Shinan", "الشنان"], ["Al Hait", "الحائط"], ["As Sulaimi", "السليمي"],
      ["Ash Shamli", "الشملي"], ["Mawqaq", "موقق"], ["Samira", "سميراء"],
    ]),
    g("Northern Borders Region", "منطقة الحدود الشمالية", [
      ["Arar", "عرعر"], ["Rafha", "رفحاء"], ["Turaif", "طريف"], ["Al Uwayqilah", "العويقيلة"],
    ]),
    g("Jazan Region", "منطقة جازان", [
      ["Jazan", "جازان"], ["Sabya", "صبيا"], ["Abu Arish", "أبو عريش"], ["Samtah", "صامطة"], ["Al Harth", "الحرث"], ["Ad Darb", "الدرب"],
      ["Al Aridah", "العارضة"], ["Baysh", "بيش"], ["Farasan", "فرسان"], ["Ad Dayer", "الداير"], ["Ahad Al Masarihah", "أحد المسارحة"], ["Al Aydabi", "العيدابي"],
      ["Ar Rayth", "الريث"], ["Damad", "ضمد"], ["At Tuwal", "الطوال"], ["Haroub", "هروب"], ["Fayfa", "فيفاء"],
    ]),
    g("Najran Region", "منطقة نجران", [
      ["Najran", "نجران"], ["Sharurah", "شرورة"], ["Hubuna", "حبونا"], ["Badr Al Janub", "بدر الجنوب"], ["Yadamah", "يدمة"], ["Thar", "ثار"], ["Khubash", "خباش"],
    ]),
    g("Al Bahah Region", "منطقة الباحة", [
      ["Al Bahah", "الباحة"], ["Baljurashi", "بلجرشي"], ["Al Mandaq", "المندق"], ["Al Makhwah", "المخواة"], ["Al Aqiq", "العقيق"], ["Qilwah", "قلوة"],
      ["Al Qura", "القرى"], ["Bani Hassan", "بني حسن"], ["Ghamid Az Zinad", "غامد الزناد"],
    ]),
    g("Al Jawf Region", "منطقة الجوف", [
      ["Sakaka", "سكاكا"], ["Dumat Al Jandal", "دومة الجندل"], ["Al Qurayyat", "القريات"], ["Tabarjal", "طبرجل"],
    ]),
  ],
  AE: [
    g("Emirates", "الإمارات", [
      ["Abu Dhabi", "أبوظبي"], ["Dubai", "دبي"], ["Sharjah", "الشارقة"], ["Ajman", "عجمان"], ["Umm Al Quwain", "أم القيوين"], ["Ras Al Khaimah", "رأس الخيمة"],
      ["Fujairah", "الفجيرة"], ["Al Ain", "العين"],
    ]),
  ],
  KW: [
    g("Governorates", "المحافظات", [
      ["Capital (Kuwait City)", "العاصمة"], ["Hawalli", "حولي"], ["Farwaniya", "الفروانية"], ["Mubarak Al-Kabeer", "مبارك الكبير"], ["Ahmadi", "الأحمدي"], ["Jahra", "الجهراء"],
    ]),
  ],
  BH: [
    g("Governorates", "المحافظات", [["Capital (Manama)", "العاصمة (المنامة)"], ["Muharraq", "المحرق"], ["Northern", "الشمالية"], ["Southern", "الجنوبية"]]),
  ],
  QA: [
    g("Municipalities", "البلديات", [["Doha", "الدوحة"], ["Al Rayyan", "الريان"], ["Al Wakrah", "الوكرة"], ["Umm Salal", "أم صلال"], ["Al Khor", "الخور"], ["Al Shamal", "الشمال"], ["Al Daayen", "الضعاين"], ["Al Shahaniya", "الشحانية"]]),
  ],
  OM: [
    g("Governorates", "المحافظات", [
      ["Muscat", "مسقط"], ["Dhofar (Salalah)", "ظفار (صلالة)"], ["Musandam", "مسندم"], ["Al Buraimi", "البريمي"], ["Ad Dakhiliyah", "الداخلية"], ["North Al Batinah", "شمال الباطنة"],
      ["South Al Batinah", "جنوب الباطنة"], ["North Ash Sharqiyah", "شمال الشرقية"], ["South Ash Sharqiyah", "جنوب الشرقية"], ["Ad Dhahirah", "الظاهرة"], ["Al Wusta", "الوسطى"],
    ]),
  ],
  JO: [
    g("Governorates", "المحافظات", [
      ["Amman", "عمّان"], ["Irbid", "إربد"], ["Zarqa", "الزرقاء"], ["Balqa (Salt)", "البلقاء (السلط)"], ["Madaba", "مادبا"], ["Mafraq", "المفرق"],
      ["Jerash", "جرش"], ["Ajloun", "عجلون"], ["Karak", "الكرك"], ["Tafilah", "الطفيلة"], ["Ma'an", "معان"], ["Aqaba", "العقبة"],
    ]),
  ],
  EG: [
    g("Governorates", "المحافظات", [
      ["Cairo", "القاهرة"], ["Giza", "الجيزة"], ["Alexandria", "الإسكندرية"], ["Qalyubia", "القليوبية"], ["Sharqia", "الشرقية"], ["Dakahlia", "الدقهلية"],
      ["Gharbia", "الغربية"], ["Monufia", "المنوفية"], ["Beheira", "البحيرة"], ["Kafr El Sheikh", "كفر الشيخ"], ["Damietta", "دمياط"], ["Port Said", "بورسعيد"],
      ["Ismailia", "الإسماعيلية"], ["Suez", "السويس"], ["Faiyum", "الفيوم"], ["Beni Suef", "بني سويف"], ["Minya", "المنيا"], ["Asyut", "أسيوط"],
      ["Sohag", "سوهاج"], ["Qena", "قنا"], ["Luxor", "الأقصر"], ["Aswan", "أسوان"], ["Red Sea", "البحر الأحمر"], ["New Valley", "الوادي الجديد"],
      ["Matrouh", "مطروح"], ["North Sinai", "شمال سيناء"], ["South Sinai", "جنوب سيناء"],
    ]),
  ],
  IQ: [
    g("Governorates", "المحافظات", [
      ["Baghdad", "بغداد"], ["Basra", "البصرة"], ["Nineveh (Mosul)", "نينوى (الموصل)"], ["Erbil", "أربيل"], ["Sulaymaniyah", "السليمانية"], ["Duhok", "دهوك"],
      ["Kirkuk", "كركوك"], ["Najaf", "النجف"], ["Karbala", "كربلاء"], ["Babil (Hillah)", "بابل (الحلة)"], ["Anbar (Ramadi)", "الأنبار (الرمادي)"], ["Diyala (Baqubah)", "ديالى (بعقوبة)"],
      ["Saladin (Tikrit)", "صلاح الدين (تكريت)"], ["Wasit (Kut)", "واسط (الكوت)"], ["Dhi Qar (Nasiriyah)", "ذي قار (الناصرية)"], ["Maysan (Amarah)", "ميسان (العمارة)"], ["Muthanna (Samawah)", "المثنى (السماوة)"], ["Qadisiyyah (Diwaniyah)", "القادسية (الديوانية)"],
      ["Halabja", "حلبجة"],
    ]),
  ],
  LB: [
    g("Governorates", "المحافظات", [
      ["Beirut", "بيروت"], ["Mount Lebanon", "جبل لبنان"], ["North (Tripoli)", "الشمال (طرابلس)"], ["Akkar", "عكار"], ["South (Sidon)", "الجنوب (صيدا)"], ["Nabatieh", "النبطية"],
      ["Beqaa (Zahle)", "البقاع (زحلة)"], ["Baalbek-Hermel", "بعلبك الهرمل"], ["Keserwan-Jbeil", "كسروان جبيل"],
    ]),
  ],
  PS: [
    g("West Bank", "الضفة الغربية", [
      ["Jerusalem", "القدس"], ["Ramallah & Al-Bireh", "رام الله والبيرة"], ["Nablus", "نابلس"], ["Hebron", "الخليل"], ["Bethlehem", "بيت لحم"], ["Jenin", "جنين"],
      ["Tulkarm", "طولكرم"], ["Qalqilya", "قلقيلية"], ["Salfit", "سلفيت"], ["Tubas", "طوباس"], ["Jericho", "أريحا"],
    ]),
    g("Gaza Strip", "قطاع غزة", [["Gaza", "غزة"], ["North Gaza", "شمال غزة"], ["Deir al-Balah", "دير البلح"], ["Khan Yunis", "خان يونس"], ["Rafah", "رفح"]]),
  ],
  MA: [
    g("Regions", "الجهات", [
      ["Casablanca-Settat", "الدار البيضاء سطات"], ["Rabat-Salé-Kénitra", "الرباط سلا القنيطرة"], ["Marrakech-Safi", "مراكش آسفي"], ["Fès-Meknès", "فاس مكناس"], ["Tanger-Tétouan-Al Hoceïma", "طنجة تطوان الحسيمة"], ["Souss-Massa (Agadir)", "سوس ماسة (أكادير)"],
      ["Oriental (Oujda)", "الشرق (وجدة)"], ["Béni Mellal-Khénifra", "بني ملال خنيفرة"], ["Drâa-Tafilalet", "درعة تافيلالت"], ["Guelmim-Oued Noun", "كلميم واد نون"], ["Laâyoune-Sakia El Hamra", "العيون الساقية الحمراء"], ["Dakhla-Oued Ed-Dahab", "الداخلة وادي الذهب"],
    ]),
  ],
  TN: [
    g("Governorates", "الولايات", [
      ["Tunis", "تونس"], ["Ariana", "أريانة"], ["Ben Arous", "بن عروس"], ["Manouba", "منوبة"], ["Nabeul", "نابل"], ["Zaghouan", "زغوان"],
      ["Bizerte", "بنزرت"], ["Béja", "باجة"], ["Jendouba", "جندوبة"], ["Kef", "الكاف"], ["Siliana", "سليانة"], ["Sousse", "سوسة"],
      ["Monastir", "المنستير"], ["Mahdia", "المهدية"], ["Sfax", "صفاقس"], ["Kairouan", "القيروان"], ["Kasserine", "القصرين"], ["Sidi Bouzid", "سيدي بوزيد"],
      ["Gabès", "قابس"], ["Medenine", "مدنين"], ["Tataouine", "تطاوين"], ["Gafsa", "قفصة"], ["Tozeur", "توزر"], ["Kebili", "قبلي"],
    ]),
  ],
  DZ: [
    g("Provinces", "الولايات", [
      ["Adrar", "أدرار"], ["Chlef", "الشلف"], ["Laghouat", "الأغواط"], ["Oum El Bouaghi", "أم البواقي"], ["Batna", "باتنة"], ["Béjaïa", "بجاية"],
      ["Biskra", "بسكرة"], ["Béchar", "بشار"], ["Blida", "البليدة"], ["Bouira", "البويرة"], ["Tamanrasset", "تمنراست"], ["Tébessa", "تبسة"],
      ["Tlemcen", "تلمسان"], ["Tiaret", "تيارت"], ["Tizi Ouzou", "تيزي وزو"], ["Algiers", "الجزائر العاصمة"], ["Djelfa", "الجلفة"], ["Jijel", "جيجل"],
      ["Sétif", "سطيف"], ["Saïda", "سعيدة"], ["Skikda", "سكيكدة"], ["Sidi Bel Abbès", "سيدي بلعباس"], ["Annaba", "عنابة"], ["Guelma", "قالمة"],
      ["Constantine", "قسنطينة"], ["Médéa", "المدية"], ["Mostaganem", "مستغانم"], ["M'Sila", "المسيلة"], ["Mascara", "معسكر"], ["Ouargla", "ورقلة"],
      ["Oran", "وهران"], ["El Bayadh", "البيض"], ["Illizi", "إليزي"], ["Bordj Bou Arréridj", "برج بوعريريج"], ["Boumerdès", "بومرداس"], ["El Tarf", "الطارف"],
      ["Tindouf", "تندوف"], ["Tissemsilt", "تيسمسيلت"], ["El Oued", "الوادي"], ["Khenchela", "خنشلة"], ["Souk Ahras", "سوق أهراس"], ["Tipaza", "تيبازة"],
      ["Mila", "ميلة"], ["Aïn Defla", "عين الدفلى"], ["Naâma", "النعامة"], ["Aïn Témouchent", "عين تموشنت"], ["Ghardaïa", "غرداية"], ["Relizane", "غليزان"],
      ["Timimoun", "تيميمون"], ["Bordj Badji Mokhtar", "برج باجي مختار"], ["Ouled Djellal", "أولاد جلال"], ["Béni Abbès", "بني عباس"], ["In Salah", "عين صالح"], ["In Guezzam", "عين قزام"],
      ["Touggourt", "تقرت"], ["Djanet", "جانت"], ["El M'Ghair", "المغير"], ["El Meniaa", "المنيعة"],
    ]),
  ],
};

export const regionPresetCount = (country: string) => (REGION_PRESETS[country] ?? []).reduce((n, g) => n + g.cities.length, 0);
