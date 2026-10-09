/* ── languages: the 10 most spoken (Ethnologue 2025, first + second language), in descending order ── */

// font: Google Fonts family for the script (null = the default DM Sans)
export const LANGS = [
  { code: "en", locale: "en-US", native: "English", english: "English", font: null },
  { code: "zh", locale: "zh-CN", native: "中文", english: "Chinese (Simplified)", font: "Noto Sans SC:wght@400;500;600;700" },
  { code: "hi", locale: "hi-IN", native: "हिन्दी", english: "Hindi", font: "Hind:wght@400;500;600;700" },
  { code: "es", locale: "es-ES", native: "Español", english: "Spanish", font: null },
  { code: "ar", locale: "ar", native: "العربية", english: "Arabic", font: "IBM Plex Sans Arabic:wght@400;500;600;700", dir: "rtl" },
  { code: "fr", locale: "fr-FR", native: "Français", english: "French", font: null },
  { code: "bn", locale: "bn-BD", native: "বাংলা", english: "Bengali", font: "Hind Siliguri:wght@400;500;600;700" },
  { code: "pt", locale: "pt-BR", native: "Português", english: "Portuguese", font: null },
  { code: "ru", locale: "ru-RU", native: "Русский", english: "Russian", font: "Golos Text:wght@400;500;600;700" },
  { code: "id", locale: "id-ID", native: "Bahasa Indonesia", english: "Indonesian", font: null },
];
export const DEFAULT_LANG = "en";
const LS_LANG = "tz-sync-lang";

const nbsp = " ";

const S = {
  en: {
    title: "Find a time to meet", myZone: "my time zone", popular: "Popular", allZones: "All time zones",
    loadedLink: "Loaded a setup from a link. It's now saved as yours.",
    loadedCode: "Loaded a setup from a code. It's now saved as yours.",
    restoreMine: "Restore mine", gotIt: "Got it",
    badLink: "This link is damaged or cut off. Showing your saved setup.",
    badCode: "This code is damaged or cut off. Showing your saved setup.",
    copyManually: "Copy it manually:", done: "Done",
    bestWindow: "Best shared window", picked: "Selected time", noWindow: "No shared window",
    liveNow: "● happening now", startsIn: "in {d}", freeOf: "{n} of {total} free", cityTime: "{city} time",
    mostFree: "most people free: {n} of {total}", duration: "Duration", shorter: "Shorter", longer: "Longer",
    copyForChat: "Copy for chat", copied: "✓ Copied", commonWindows: "Shared windows:",
    pickOther: "You can pick another time on the grid below.", backToBest: "↺ Back to best",
    nobodyHours: "Nobody has working hours yet. Tap a participant to set theirs.",
    modeGroup: "What a click on the grid does", modeView: "Pick a time", modeEdit: "Edit hours",
    pasteCode: "Paste code", copyCode: "Copy code", shareLink: "Share link",
    pastePh: "Paste a code or link", load: "Load", cancel: "Cancel",
    gridLabel: "Participants' hours in your time zone", pickHour: "Select {time}", addParticipant: "+ Add participant",
    legendWork: "working hours", legendAll: "everyone free", legendNight: "night (00–07)", legendNow: "now",
    hintView: "Tap an hour or drag with the mouse to pick a time. Numbers in the cells are local time.",
    hintEdit: "Tap a cell to turn an hour on or off. You can drag with the mouse.",
    removed: "Removed: {name}", undo: "Undo", editTip: "Tap to edit", cellWork: "working hour", cellOff: "off work",
    free: "free", busy: "busy", newParticipant: "New participant", participant: "Participant",
    nameLabel: "Name or role", namePh: "e.g. Anna or “Design”", cityLabel: "City",
    tzLabel: "Time zone · it's {time} there now", hoursLabel: "Working hours (local time)",
    allDay: "All day", clear: "Clear", range: "from {from} to {to}", set: "Apply",
    hoursAria: "Hours: tap to turn on or off", noHours: "No working hours",
    delete: "Delete", add: "Add", save: "Save",
    inviteHead: "Call: {day} {from}–{to} ({city})", outsideHours: "(outside working hours)",
    language: "Language", you: "You", design: "Design", sales: "Sales", engineering: "Engineering",
  },
  zh: {
    title: "找到适合开会的时间", myZone: "我的时区", popular: "常用", allZones: "全部时区",
    loadedLink: "已从链接载入配置，并保存为你的配置。", loadedCode: "已从代码载入配置，并保存为你的配置。",
    restoreMine: "恢复我的配置", gotIt: "知道了",
    badLink: "链接已损坏或不完整，正在显示你保存的配置。", badCode: "代码已损坏或不完整，正在显示你保存的配置。",
    copyManually: "请手动复制：", done: "完成",
    bestWindow: "最佳共同时段", picked: "已选时间", noWindow: "没有共同时段",
    liveNow: "● 正在进行", startsIn: "{d}后开始", freeOf: "{total} 人中 {n} 人有空", cityTime: "{city}时间",
    mostFree: "最多有空：{total} 人中 {n} 人", duration: "时长", shorter: "缩短", longer: "延长",
    copyForChat: "复制到聊天", copied: "✓ 已复制", commonWindows: "共同时段：",
    pickOther: "也可以在下方时间表中选择其他时间。", backToBest: "↺ 回到最佳时段",
    nobodyHours: "还没有人设置工作时间。点按参与者即可设置。",
    modeGroup: "点击时间表的作用", modeView: "选择时间", modeEdit: "编辑工作时间",
    pasteCode: "粘贴代码", copyCode: "复制代码", shareLink: "分享链接",
    pastePh: "粘贴代码或链接", load: "载入", cancel: "取消",
    gridLabel: "按你的时区显示的参与者工作时间", pickHour: "选择 {time}", addParticipant: "+ 添加参与者",
    legendWork: "工作时间", legendAll: "全员有空", legendNight: "夜间（00–07）", legendNow: "现在",
    hintView: "点按某个小时或用鼠标拖动来选择时间。格子里的数字是当地时间。",
    hintEdit: "点按格子可开启或关闭该小时，也可以用鼠标拖动。",
    removed: "已删除：{name}", undo: "撤销", editTip: "点按以编辑", cellWork: "工作时间", cellOff: "非工作时间",
    free: "有空", busy: "没空", newParticipant: "新参与者", participant: "参与者",
    nameLabel: "姓名或角色", namePh: "例如：小林 或“设计”", cityLabel: "城市",
    tzLabel: "时区 · 当地现在 {time}", hoursLabel: "工作时间（当地时间）",
    allDay: "全天", clear: "清空", range: "从 {from} 到 {to}", set: "应用",
    hoursAria: "小时：点按开启或关闭", noHours: "没有工作时间",
    delete: "删除", add: "添加", save: "保存",
    inviteHead: "会议：{day} {from}–{to}（{city}）", outsideHours: "（非工作时间）",
    language: "语言", you: "你", design: "设计", sales: "销售", engineering: "工程",
  },
  hi: {
    title: "मीटिंग के लिए समय खोजें", myZone: "मेरा समय क्षेत्र", popular: "लोकप्रिय", allZones: "सभी समय क्षेत्र",
    loadedLink: "लिंक से सेटअप लोड हुआ। अब यह आपके सेटअप के रूप में सहेजा गया है।",
    loadedCode: "कोड से सेटअप लोड हुआ। अब यह आपके सेटअप के रूप में सहेजा गया है।",
    restoreMine: "मेरा वापस लाएँ", gotIt: "ठीक है",
    badLink: "लिंक टूटा हुआ या अधूरा है। आपका सहेजा गया सेटअप दिखाया जा रहा है।",
    badCode: "कोड टूटा हुआ या अधूरा है। आपका सहेजा गया सेटअप दिखाया जा रहा है।",
    copyManually: "इसे खुद कॉपी करें:", done: "हो गया",
    bestWindow: "सबसे अच्छा साझा समय", picked: "चुना गया समय", noWindow: "कोई साझा समय नहीं",
    liveNow: "● अभी चल रहा है", startsIn: "{d} में", freeOf: "{total} में से {n} खाली", cityTime: "{city} का समय",
    mostFree: "सबसे ज़्यादा लोग खाली: {total} में से {n}", duration: "अवधि", shorter: "छोटा करें", longer: "लंबा करें",
    copyForChat: "चैट के लिए कॉपी करें", copied: "✓ कॉपी हो गया", commonWindows: "साझा समय:",
    pickOther: "नीचे ग्रिड पर दूसरा समय चुन सकते हैं।", backToBest: "↺ सबसे अच्छे पर लौटें",
    nobodyHours: "किसी के भी काम के घंटे तय नहीं हैं। घंटे तय करने के लिए किसी प्रतिभागी पर टैप करें।",
    modeGroup: "ग्रिड पर क्लिक क्या करता है", modeView: "समय चुनें", modeEdit: "घंटे बदलें",
    pasteCode: "कोड चिपकाएँ", copyCode: "कोड कॉपी करें", shareLink: "लिंक साझा करें",
    pastePh: "कोड या लिंक चिपकाएँ", load: "लोड करें", cancel: "रद्द करें",
    gridLabel: "आपके समय क्षेत्र में प्रतिभागियों के घंटे", pickHour: "{time} चुनें", addParticipant: "+ प्रतिभागी जोड़ें",
    legendWork: "काम के घंटे", legendAll: "सभी खाली", legendNight: "रात (00–07)", legendNow: "अभी",
    hintView: "समय चुनने के लिए किसी घंटे पर टैप करें या माउस से खींचें। खानों में स्थानीय समय दिखता है।",
    hintEdit: "घंटा चालू या बंद करने के लिए खाने पर टैप करें। माउस से खींच भी सकते हैं।",
    removed: "हटाया गया: {name}", undo: "पूर्ववत करें", editTip: "बदलने के लिए टैप करें", cellWork: "काम का घंटा", cellOff: "काम नहीं",
    free: "खाली", busy: "व्यस्त", newParticipant: "नया प्रतिभागी", participant: "प्रतिभागी",
    nameLabel: "नाम या भूमिका", namePh: "जैसे, अनीता या “डिज़ाइन”", cityLabel: "शहर",
    tzLabel: "समय क्षेत्र · वहाँ अभी {time} बजे हैं", hoursLabel: "काम के घंटे (स्थानीय समय)",
    allDay: "पूरा दिन", clear: "साफ़ करें", range: "{from} से {to} तक", set: "लागू करें",
    hoursAria: "घंटे: चालू या बंद करने के लिए टैप करें", noHours: "काम के कोई घंटे नहीं",
    delete: "हटाएँ", add: "जोड़ें", save: "सहेजें",
    inviteHead: "कॉल: {day} {from}–{to} ({city})", outsideHours: "(काम के घंटों के बाहर)",
    language: "भाषा", you: "आप", design: "डिज़ाइन", sales: "सेल्स", engineering: "इंजीनियरिंग",
  },
  es: {
    title: "Encuentra una hora para reunirse", myZone: "mi zona horaria", popular: "Populares", allZones: "Todas las zonas",
    loadedLink: "Se cargó una configuración desde un enlace. Ahora está guardada como tuya.",
    loadedCode: "Se cargó una configuración desde un código. Ahora está guardada como tuya.",
    restoreMine: "Recuperar la mía", gotIt: "Entendido",
    badLink: "El enlace está dañado o incompleto. Se muestra tu configuración guardada.",
    badCode: "El código está dañado o incompleto. Se muestra tu configuración guardada.",
    copyManually: "Cópialo a mano:", done: "Listo",
    bestWindow: "Mejor franja común", picked: "Hora elegida", noWindow: "No hay franja común",
    liveNow: "● en curso", startsIn: "en {d}", freeOf: "{n} de {total} libres", cityTime: "hora de {city}",
    mostFree: "máximo de personas libres: {n} de {total}", duration: "Duración", shorter: "Más corta", longer: "Más larga",
    copyForChat: "Copiar para el chat", copied: "✓ Copiado", commonWindows: "Franjas comunes:",
    pickOther: "Puedes elegir otra hora en la cuadrícula de abajo.", backToBest: "↺ Volver a la mejor",
    nobodyHours: "Nadie tiene horario definido. Toca a un participante para configurarlo.",
    modeGroup: "Qué hace un clic en la cuadrícula", modeView: "Elegir hora", modeEdit: "Editar horario",
    pasteCode: "Pegar código", copyCode: "Copiar código", shareLink: "Compartir enlace",
    pastePh: "Pega un código o enlace", load: "Cargar", cancel: "Cancelar",
    gridLabel: "Horario de los participantes en tu zona horaria", pickHour: "Elegir {time}", addParticipant: "+ Añadir participante",
    legendWork: "horario laboral", legendAll: "todos libres", legendNight: "noche (00–07)", legendNow: "ahora",
    hintView: "Toca una hora o arrastra con el ratón para elegir. Los números de las celdas son la hora local.",
    hintEdit: "Toca una celda para activar o desactivar una hora. Puedes arrastrar con el ratón.",
    removed: "Eliminado: {name}", undo: "Deshacer", editTip: "Toca para editar", cellWork: "hora laboral", cellOff: "fuera de horario",
    free: "libre", busy: "ocupado", newParticipant: "Nuevo participante", participant: "Participante",
    nameLabel: "Nombre o rol", namePh: "p. ej., Ana o «Diseño»", cityLabel: "Ciudad",
    tzLabel: "Zona horaria · allí son las {time}", hoursLabel: "Horario laboral (hora local)",
    allDay: "Todo el día", clear: "Borrar", range: "de {from} a {to}", set: "Aplicar",
    hoursAria: "Horas: toca para activar o desactivar", noHours: "Sin horario laboral",
    delete: "Eliminar", add: "Añadir", save: "Guardar",
    inviteHead: "Llamada: {day} {from}–{to} ({city})", outsideHours: "(fuera de horario)",
    language: "Idioma", you: "Tú", design: "Diseño", sales: "Ventas", engineering: "Ingeniería",
  },
  ar: {
    title: "اعثر على وقت للاجتماع", myZone: "منطقتي الزمنية", popular: "الأكثر استخدامًا", allZones: "كل المناطق الزمنية",
    loadedLink: "تم تحميل إعداد من رابط، وأصبح محفوظًا كإعدادك.", loadedCode: "تم تحميل إعداد من رمز، وأصبح محفوظًا كإعدادك.",
    restoreMine: "استعادة إعدادي", gotIt: "حسنًا",
    badLink: "الرابط تالف أو غير مكتمل. يُعرض إعدادك المحفوظ.", badCode: "الرمز تالف أو غير مكتمل. يُعرض إعدادك المحفوظ.",
    copyManually: "انسخه يدويًا:", done: "تم",
    bestWindow: "أفضل وقت مشترك", picked: "الوقت المختار", noWindow: "لا يوجد وقت مشترك",
    liveNow: "● جارٍ الآن", startsIn: "بعد {d}", freeOf: "{n} من {total} متاحون", cityTime: "بتوقيت {city}",
    mostFree: "أكبر عدد متاح: {n} من {total}", duration: "المدة", shorter: "أقصر", longer: "أطول",
    copyForChat: "نسخ للدردشة", copied: "✓ تم النسخ", commonWindows: "الأوقات المشتركة:",
    pickOther: "يمكنك اختيار وقت آخر من الجدول أدناه.", backToBest: "↺ العودة إلى الأفضل",
    nobodyHours: "لم يحدد أحد ساعات عمله بعد. اضغط على أحد المشاركين لتحديدها.",
    modeGroup: "ماذا يفعل النقر على الجدول", modeView: "اختيار الوقت", modeEdit: "تعديل الساعات",
    pasteCode: "لصق رمز", copyCode: "نسخ الرمز", shareLink: "مشاركة الرابط",
    pastePh: "الصق رمزًا أو رابطًا", load: "تحميل", cancel: "إلغاء",
    gridLabel: "ساعات المشاركين بتوقيت منطقتك", pickHour: "اختيار {time}", addParticipant: "+ إضافة مشارك",
    legendWork: "ساعات العمل", legendAll: "الجميع متاح", legendNight: "الليل (00–07)", legendNow: "الآن",
    hintView: "اضغط على ساعة أو اسحب بالفأرة لاختيار الوقت. الأرقام في الخانات بالتوقيت المحلي.",
    hintEdit: "اضغط على خانة لتفعيل الساعة أو إلغائها. يمكنك السحب بالفأرة.",
    removed: "تم الحذف: {name}", undo: "تراجع", editTip: "اضغط للتعديل", cellWork: "ساعة عمل", cellOff: "خارج العمل",
    free: "متاح", busy: "مشغول", newParticipant: "مشارك جديد", participant: "مشارك",
    nameLabel: "الاسم أو الدور", namePh: "مثلًا: سارة أو «التصميم»", cityLabel: "المدينة",
    tzLabel: "المنطقة الزمنية · الساعة هناك الآن {time}", hoursLabel: "ساعات العمل (بالتوقيت المحلي)",
    allDay: "طوال اليوم", clear: "مسح", range: "من {from} إلى {to}", set: "تطبيق",
    hoursAria: "الساعات: اضغط للتفعيل أو الإلغاء", noHours: "لا توجد ساعات عمل",
    delete: "حذف", add: "إضافة", save: "حفظ",
    inviteHead: "مكالمة: {day} {from}–{to} ({city})", outsideHours: "(خارج ساعات العمل)",
    language: "اللغة", you: "أنت", design: "التصميم", sales: "المبيعات", engineering: "الهندسة",
  },
  fr: {
    title: "Trouvez un créneau pour vous réunir", myZone: "mon fuseau", popular: "Courants", allZones: "Tous les fuseaux",
    loadedLink: "Configuration chargée depuis un lien. Elle est désormais enregistrée comme la vôtre.",
    loadedCode: "Configuration chargée depuis un code. Elle est désormais enregistrée comme la vôtre.",
    restoreMine: "Récupérer la mienne", gotIt: "Compris",
    badLink: "Le lien est endommagé ou incomplet. Votre configuration enregistrée est affichée.",
    badCode: "Le code est endommagé ou incomplet. Votre configuration enregistrée est affichée.",
    copyManually: `Copiez-le manuellement${nbsp}:`, done: "Terminé",
    bestWindow: "Meilleur créneau commun", picked: "Créneau choisi", noWindow: "Aucun créneau commun",
    liveNow: "● en cours", startsIn: "dans {d}", freeOf: "{n} sur {total} disponibles", cityTime: "heure de {city}",
    mostFree: `le plus de disponibles${nbsp}: {n} sur {total}`, duration: "Durée", shorter: "Plus court", longer: "Plus long",
    copyForChat: "Copier pour le chat", copied: "✓ Copié", commonWindows: `Créneaux communs${nbsp}:`,
    pickOther: "Vous pouvez choisir un autre horaire dans la grille ci-dessous.", backToBest: "↺ Revenir au meilleur",
    nobodyHours: "Personne n’a encore d’horaires. Touchez un participant pour les régler.",
    modeGroup: "Effet d’un clic sur la grille", modeView: "Choisir l’heure", modeEdit: "Modifier les horaires",
    pasteCode: "Coller un code", copyCode: "Copier le code", shareLink: "Partager le lien",
    pastePh: "Collez un code ou un lien", load: "Charger", cancel: "Annuler",
    gridLabel: "Horaires des participants dans votre fuseau", pickHour: "Choisir {time}", addParticipant: "+ Ajouter un participant",
    legendWork: "heures de travail", legendAll: "tous disponibles", legendNight: "nuit (00–07)", legendNow: "maintenant",
    hintView: "Touchez une heure ou faites glisser la souris pour choisir. Les chiffres des cases indiquent l’heure locale.",
    hintEdit: "Touchez une case pour activer ou désactiver une heure. Vous pouvez faire glisser la souris.",
    removed: `Supprimé${nbsp}: {name}`, undo: "Annuler", editTip: "Touchez pour modifier", cellWork: "heure de travail", cellOff: "hors travail",
    free: "disponible", busy: "occupé", newParticipant: "Nouveau participant", participant: "Participant",
    nameLabel: "Nom ou rôle", namePh: `p.${nbsp}ex. Léa ou «${nbsp}Design${nbsp}»`, cityLabel: "Ville",
    tzLabel: "Fuseau horaire · il y est {time}", hoursLabel: "Heures de travail (heure locale)",
    allDay: "Toute la journée", clear: "Effacer", range: "de {from} à {to}", set: "Appliquer",
    hoursAria: `Heures${nbsp}: touchez pour activer ou désactiver`, noHours: "Aucune heure de travail",
    delete: "Supprimer", add: "Ajouter", save: "Enregistrer",
    inviteHead: `Appel${nbsp}: {day} {from}–{to} ({city})`, outsideHours: "(hors heures de travail)",
    language: "Langue", you: "Vous", design: "Design", sales: "Ventes", engineering: "Ingénierie",
  },
  bn: {
    title: "মিটিংয়ের জন্য সময় খুঁজুন", myZone: "আমার সময় অঞ্চল", popular: "জনপ্রিয়", allZones: "সব সময় অঞ্চল",
    loadedLink: "লিংক থেকে সেটআপ লোড হয়েছে। এখন এটি আপনার সেটআপ হিসেবে সংরক্ষিত।",
    loadedCode: "কোড থেকে সেটআপ লোড হয়েছে। এখন এটি আপনার সেটআপ হিসেবে সংরক্ষিত।",
    restoreMine: "আমারটা ফিরিয়ে আনুন", gotIt: "ঠিক আছে",
    badLink: "লিংকটি নষ্ট বা অসম্পূর্ণ। আপনার সংরক্ষিত সেটআপ দেখানো হচ্ছে।",
    badCode: "কোডটি নষ্ট বা অসম্পূর্ণ। আপনার সংরক্ষিত সেটআপ দেখানো হচ্ছে।",
    copyManually: "নিজে কপি করুন:", done: "হয়ে গেছে",
    bestWindow: "সবচেয়ে ভালো সাধারণ সময়", picked: "বেছে নেওয়া সময়", noWindow: "কোনো সাধারণ সময় নেই",
    liveNow: "● এখন চলছে", startsIn: "{d} পরে", freeOf: "{total} জনের মধ্যে {n} জন ফাঁকা", cityTime: "{city}-এর সময়",
    mostFree: "সবচেয়ে বেশি ফাঁকা: {total} জনের মধ্যে {n} জন", duration: "সময়কাল", shorter: "ছোট করুন", longer: "বড় করুন",
    copyForChat: "চ্যাটের জন্য কপি করুন", copied: "✓ কপি হয়েছে", commonWindows: "সাধারণ সময়:",
    pickOther: "নিচের গ্রিডে অন্য সময় বেছে নিতে পারেন।", backToBest: "↺ সেরা সময়ে ফিরুন",
    nobodyHours: "কারও কাজের সময় এখনো ঠিক করা নেই। সময় ঠিক করতে একজন অংশগ্রহণকারীতে ট্যাপ করুন।",
    modeGroup: "গ্রিডে ক্লিক করলে কী হয়", modeView: "সময় বাছুন", modeEdit: "সময় বদলান",
    pasteCode: "কোড পেস্ট করুন", copyCode: "কোড কপি করুন", shareLink: "লিংক শেয়ার করুন",
    pastePh: "কোড বা লিংক পেস্ট করুন", load: "লোড করুন", cancel: "বাতিল",
    gridLabel: "আপনার সময় অঞ্চলে অংশগ্রহণকারীদের সময়", pickHour: "{time} বেছে নিন", addParticipant: "+ অংশগ্রহণকারী যোগ করুন",
    legendWork: "কাজের সময়", legendAll: "সবাই ফাঁকা", legendNight: "রাত (00–07)", legendNow: "এখন",
    hintView: "সময় বাছতে কোনো ঘণ্টায় ট্যাপ করুন বা মাউস দিয়ে টানুন। ঘরের সংখ্যাগুলো স্থানীয় সময়।",
    hintEdit: "ঘণ্টা চালু বা বন্ধ করতে ঘরে ট্যাপ করুন। মাউস দিয়ে টানতেও পারেন।",
    removed: "সরানো হয়েছে: {name}", undo: "ফিরিয়ে আনুন", editTip: "বদলাতে ট্যাপ করুন", cellWork: "কাজের ঘণ্টা", cellOff: "কাজ নেই",
    free: "ফাঁকা", busy: "ব্যস্ত", newParticipant: "নতুন অংশগ্রহণকারী", participant: "অংশগ্রহণকারী",
    nameLabel: "নাম বা ভূমিকা", namePh: "যেমন, অনিতা বা “ডিজাইন”", cityLabel: "শহর",
    tzLabel: "সময় অঞ্চল · সেখানে এখন {time}", hoursLabel: "কাজের সময় (স্থানীয় সময়)",
    allDay: "সারা দিন", clear: "মুছুন", range: "{from} থেকে {to} পর্যন্ত", set: "প্রয়োগ করুন",
    hoursAria: "ঘণ্টা: চালু বা বন্ধ করতে ট্যাপ করুন", noHours: "কোনো কাজের সময় নেই",
    delete: "মুছে ফেলুন", add: "যোগ করুন", save: "সংরক্ষণ করুন",
    inviteHead: "কল: {day} {from}–{to} ({city})", outsideHours: "(কাজের সময়ের বাইরে)",
    language: "ভাষা", you: "আপনি", design: "ডিজাইন", sales: "সেলস", engineering: "ইঞ্জিনিয়ারিং",
  },
  pt: {
    title: "Encontre um horário para a reunião", myZone: "meu fuso", popular: "Populares", allZones: "Todos os fusos",
    loadedLink: "Configuração carregada de um link. Agora ela está salva como sua.",
    loadedCode: "Configuração carregada de um código. Agora ela está salva como sua.",
    restoreMine: "Recuperar a minha", gotIt: "Entendi",
    badLink: "O link está danificado ou incompleto. Mostrando sua configuração salva.",
    badCode: "O código está danificado ou incompleto. Mostrando sua configuração salva.",
    copyManually: "Copie manualmente:", done: "Pronto",
    bestWindow: "Melhor horário em comum", picked: "Horário escolhido", noWindow: "Nenhum horário em comum",
    liveNow: "● acontecendo agora", startsIn: "em {d}", freeOf: "{n} de {total} livres", cityTime: "horário de {city}",
    mostFree: "mais pessoas livres: {n} de {total}", duration: "Duração", shorter: "Mais curta", longer: "Mais longa",
    copyForChat: "Copiar para o chat", copied: "✓ Copiado", commonWindows: "Horários em comum:",
    pickOther: "Você pode escolher outro horário na grade abaixo.", backToBest: "↺ Voltar ao melhor",
    nobodyHours: "Ninguém definiu horário de trabalho ainda. Toque em um participante para definir.",
    modeGroup: "O que um clique na grade faz", modeView: "Escolher horário", modeEdit: "Editar horas",
    pasteCode: "Colar código", copyCode: "Copiar código", shareLink: "Compartilhar link",
    pastePh: "Cole um código ou link", load: "Carregar", cancel: "Cancelar",
    gridLabel: "Horas dos participantes no seu fuso", pickHour: "Escolher {time}", addParticipant: "+ Adicionar participante",
    legendWork: "horário de trabalho", legendAll: "todos livres", legendNight: "noite (00–07)", legendNow: "agora",
    hintView: "Toque em uma hora ou arraste com o mouse para escolher. Os números nas células são o horário local.",
    hintEdit: "Toque em uma célula para ativar ou desativar uma hora. Dá para arrastar com o mouse.",
    removed: "Removido: {name}", undo: "Desfazer", editTip: "Toque para editar", cellWork: "hora de trabalho", cellOff: "fora do expediente",
    free: "livre", busy: "ocupado", newParticipant: "Novo participante", participant: "Participante",
    nameLabel: "Nome ou função", namePh: "ex.: Ana ou “Design”", cityLabel: "Cidade",
    tzLabel: "Fuso horário · lá agora são {time}", hoursLabel: "Horário de trabalho (hora local)",
    allDay: "Dia todo", clear: "Limpar", range: "das {from} às {to}", set: "Aplicar",
    hoursAria: "Horas: toque para ativar ou desativar", noHours: "Sem horário de trabalho",
    delete: "Excluir", add: "Adicionar", save: "Salvar",
    inviteHead: "Reunião: {day} {from}–{to} ({city})", outsideHours: "(fora do expediente)",
    language: "Idioma", you: "Você", design: "Design", sales: "Vendas", engineering: "Engenharia",
  },
  ru: {
    title: "Найди окно для созвона", myZone: "мой пояс", popular: "Популярные", allZones: "Все зоны",
    loadedLink: "Загружена конфигурация из ссылки. Она сохранена как твоя.",
    loadedCode: "Загружена конфигурация из кода. Она сохранена как твоя.",
    restoreMine: "Вернуть мою", gotIt: "Понятно",
    badLink: "Ссылка повреждена или обрезана. Показана твоя сохранённая конфигурация.",
    badCode: "Код повреждён или обрезан. Показана твоя сохранённая конфигурация.",
    copyManually: "Скопируй вручную:", done: "Готово",
    bestWindow: "Лучшее общее окно", picked: "Выбранное время", noWindow: "Общего окна нет",
    liveNow: "● идёт сейчас", startsIn: "через {d}", freeOf: "свободны {n} из {total}", cityTime: "по времени {city}",
    mostFree: "больше всего свободных: {n} из {total}", duration: "Длительность", shorter: "Короче", longer: "Длиннее",
    copyForChat: "Скопировать для чата", copied: "✓ Скопировано", commonWindows: "Общие окна:",
    pickOther: "Можно выбрать другое время на шкале ниже.", backToBest: "↺ к лучшему",
    nobodyHours: "Ни у кого нет отмеченных часов. Нажми на участника и задай его рабочие часы.",
    modeGroup: "Что делает клик по шкале", modeView: "Выбор времени", modeEdit: "Правка часов",
    pasteCode: "Вставить код", copyCode: "Скопировать код", shareLink: "Поделиться ссылкой",
    pastePh: "Вставь код или ссылку", load: "Загрузить", cancel: "Отмена",
    gridLabel: "Часы участников по времени выбранного пояса", pickHour: "Выбрать {time}", addParticipant: "+ Добавить участника",
    legendWork: "рабочие часы", legendAll: "все свободны", legendNight: "ночь (00–07)", legendNow: "сейчас",
    hintView: "Нажми на час или протяни мышью, чтобы выбрать время. Цифры в ячейках — местное время.",
    hintEdit: "Нажми на ячейку, чтобы включить или выключить час. Мышью можно протянуть.",
    removed: "Удалён: {name}", undo: "Отменить", editTip: "Нажми, чтобы изменить", cellWork: "рабочий час", cellOff: "не работает",
    free: "свободен", busy: "занят", newParticipant: "Новый участник", participant: "Участник",
    nameLabel: "Имя или роль", namePh: "Например, Аня или «Дизайн»", cityLabel: "Город",
    tzLabel: "Часовой пояс · сейчас там {time}", hoursLabel: "Рабочие часы (по местному времени)",
    allDay: "Весь день", clear: "Очистить", range: "с {from} до {to}", set: "Задать",
    hoursAria: "Часы: нажми, чтобы включить или выключить", noHours: "Нет рабочих часов",
    delete: "Удалить", add: "Добавить", save: "Сохранить",
    inviteHead: "Созвон: {day} {from}–{to} ({city})", outsideHours: "(вне рабочих часов)",
    language: "Язык", you: "Ты", design: "Дизайн", sales: "Продажи", engineering: "Разработка",
  },
  id: {
    title: "Temukan waktu untuk rapat", myZone: "zona waktu saya", popular: "Populer", allZones: "Semua zona waktu",
    loadedLink: "Pengaturan dimuat dari tautan. Sekarang tersimpan sebagai milik Anda.",
    loadedCode: "Pengaturan dimuat dari kode. Sekarang tersimpan sebagai milik Anda.",
    restoreMine: "Pulihkan milik saya", gotIt: "Mengerti",
    badLink: "Tautan rusak atau terpotong. Menampilkan pengaturan Anda yang tersimpan.",
    badCode: "Kode rusak atau terpotong. Menampilkan pengaturan Anda yang tersimpan.",
    copyManually: "Salin secara manual:", done: "Selesai",
    bestWindow: "Waktu bersama terbaik", picked: "Waktu yang dipilih", noWindow: "Tidak ada waktu bersama",
    liveNow: "● sedang berlangsung", startsIn: "dalam {d}", freeOf: "{n} dari {total} senggang", cityTime: "waktu {city}",
    mostFree: "paling banyak senggang: {n} dari {total}", duration: "Durasi", shorter: "Lebih singkat", longer: "Lebih lama",
    copyForChat: "Salin untuk chat", copied: "✓ Tersalin", commonWindows: "Waktu bersama:",
    pickOther: "Anda bisa memilih waktu lain di kisi di bawah.", backToBest: "↺ Kembali ke terbaik",
    nobodyHours: "Belum ada yang mengatur jam kerja. Ketuk peserta untuk mengaturnya.",
    modeGroup: "Fungsi klik pada kisi", modeView: "Pilih waktu", modeEdit: "Ubah jam",
    pasteCode: "Tempel kode", copyCode: "Salin kode", shareLink: "Bagikan tautan",
    pastePh: "Tempel kode atau tautan", load: "Muat", cancel: "Batal",
    gridLabel: "Jam peserta menurut zona waktu Anda", pickHour: "Pilih {time}", addParticipant: "+ Tambah peserta",
    legendWork: "jam kerja", legendAll: "semua senggang", legendNight: "malam (00–07)", legendNow: "sekarang",
    hintView: "Ketuk satu jam atau seret dengan mouse untuk memilih waktu. Angka di sel adalah waktu setempat.",
    hintEdit: "Ketuk sel untuk menyalakan atau mematikan satu jam. Anda bisa menyeret dengan mouse.",
    removed: "Dihapus: {name}", undo: "Urungkan", editTip: "Ketuk untuk mengubah", cellWork: "jam kerja", cellOff: "di luar jam kerja",
    free: "senggang", busy: "sibuk", newParticipant: "Peserta baru", participant: "Peserta",
    nameLabel: "Nama atau peran", namePh: "mis. Sari atau “Desain”", cityLabel: "Kota",
    tzLabel: "Zona waktu · di sana sekarang {time}", hoursLabel: "Jam kerja (waktu setempat)",
    allDay: "Sepanjang hari", clear: "Kosongkan", range: "dari {from} sampai {to}", set: "Terapkan",
    hoursAria: "Jam: ketuk untuk menyalakan atau mematikan", noHours: "Tidak ada jam kerja",
    delete: "Hapus", add: "Tambah", save: "Simpan",
    inviteHead: "Rapat: {day} {from}–{to} ({city})", outsideHours: "(di luar jam kerja)",
    language: "Bahasa", you: "Anda", design: "Desain", sales: "Penjualan", engineering: "Teknik",
  },
};
export const STRINGS = S;

export const langInfo = (code) => LANGS.find(l => l.code === code) || LANGS[0];

// Saved choice → browser languages → English
export function detectLang() {
  try {
    const saved = localStorage.getItem(LS_LANG);
    if (saved && S[saved]) return saved;
  } catch {}
  const list = (typeof navigator !== "undefined" && (navigator.languages || [navigator.language])) || [];
  for (const tag of list) {
    let base = String(tag || "").toLowerCase().split("-")[0];
    if (base === "in") base = "id"; // legacy code for Indonesian
    if (S[base]) return base;
  }
  return DEFAULT_LANG;
}

export function saveLang(code) {
  try { localStorage.setItem(LS_LANG, code); } catch {}
}

// Translator: t("freeOf", { n: 3, total: 4 })
export function makeT(code) {
  const table = S[code] || S.en;
  return (key, vars) => {
    let s = table[key] ?? S.en[key] ?? key;
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
    return s;
  };
}

// "from {from} to {to}" → ["from ", {slot:"from"}, " to ", {slot:"to"}] so selects can sit inside the sentence
export function splitTemplate(str) {
  return str.split(/(\{\w+\})/).filter(Boolean).map(p => (p.startsWith("{") ? { slot: p.slice(1, -1) } : p));
}

/* ── locale-aware formatting (digits stay Latin to match the clock faces) ── */
const nf = (code, opts) => new Intl.NumberFormat(`${langInfo(code).locale}-u-nu-latn`, opts);

export function fmtUnit(code, n, unit) {
  try { return nf(code, { style: "unit", unit, unitDisplay: "short" }).format(n); }
  catch { return `${n} ${unit === "hour" ? "h" : "min"}`; }
}

export function fmtDuration(code, minutes) {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  if (!h) return fmtUnit(code, m, "minute");
  return m ? `${fmtUnit(code, h, "hour")} ${fmtUnit(code, m, "minute")}` : fmtUnit(code, h, "hour");
}

export function fmtWeekday(code, date, tz) {
  return date.toLocaleDateString(`${langInfo(code).locale}-u-nu-latn`, { timeZone: tz, weekday: "short" });
}

export function fmtLongDate(code, date, tz) {
  return date.toLocaleDateString(`${langInfo(code).locale}-u-nu-latn`, { timeZone: tz, weekday: "short", day: "numeric", month: "long" });
}

/* ── fonts: load only the script the current language needs ── */
export function ensureFont(code) {
  const { font } = langInfo(code);
  if (!font || typeof document === "undefined") return;
  const id = `font-${code}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}&display=swap`;
  document.head.appendChild(link);
}

// Example team for first-time visitors (names in their language)
export function makeDefaults(code, myTZ) {
  const t = makeT(code);
  return [
    { name: t("you"), tz: myTZ, workHours: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
    { name: t("design"), city: "London", tz: "Europe/London", workHours: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
    { name: t("sales"), city: "New York", tz: "America/New_York", workHours: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
    { name: t("engineering"), city: "Bengaluru", tz: "Asia/Kolkata", workHours: [11, 12, 13, 14, 15, 16, 17, 18, 19] },
  ];
}
