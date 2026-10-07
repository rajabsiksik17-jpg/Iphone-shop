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
};

export const regionPresetCount = (country: string) => (REGION_PRESETS[country] ?? []).reduce((n, g) => n + g.cities.length, 0);
