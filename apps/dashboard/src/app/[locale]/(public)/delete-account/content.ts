// Copy of the public account-deletion page (logix-co.com/{ar,en}/delete-account). Google Play requires a
// public web page where a person can ask for their account and data to be deleted without the app.
// Describe what the backend really does (apps/backend account-deletion.service.ts).

export const RETENTION_DAYS = 30;

export interface DeleteAccountContent {
  title: string;
  intro: string;
  whatTitle: string;
  what: string[];
  keptTitle: string;
  kept: string[];
  blockedTitle: string;
  blocked: string[];
  formTitle: string;
  phoneLabel: string;
  phoneHint: string;
  sendCode: string;
  codeLabel: string;
  codeSent: string;
  confirmDelete: string;
  confirmWarning: string;
  working: string;
  doneTitle: string;
  done: string;
  invalidPhone: string;
  invalidCode: string;
  tooMany: string;
  failed: string;
  back: string;
  otherLanguage: string;
  contact: string;
}

export const content: Record<"ar" | "en", DeleteAccountContent> = {
  ar: {
    title: "حذف الحساب",
    intro: "يمكنك طلب حذف حسابك في Logix وبياناتك الشخصية من هنا، دون الحاجة لفتح التطبيق. سنرسل رمز تحقق إلى رقم جوالك للتأكد أنك صاحب الحساب.",
    whatTitle: "ما الذي يحدث عند الحذف",
    what: [
      "يُغلق حسابك فوراً وتنتهي كل جلساتك على كل أجهزتك، وتتوقف الإشعارات.",
      "إذا كنت المالك الوحيد لمنشأتك فتُغلق المنشأة معك ويُوقف عرض منتجاتها.",
      "يتحرر رقم جوالك وبريدك الإلكتروني، فيمكنك التسجيل بهما من جديد.",
      `بعد ${RETENTION_DAYS} يوماً نمحو هويتك نهائياً: الاسم ورقم الجوال والبريد الإلكتروني والصورة.`,
    ],
    keptTitle: "ما نحتفظ به للمدة النظامية",
    kept: [
      "الفواتير والمدفوعات والتسويات والعقود، لأن القانون يلزمنا بحفظها.",
      "سجل موافقاتك على الشروط. تبقى هذه السجلات مرتبطة بحساب مجهول الهوية بعد المحو.",
    ],
    blockedTitle: "متى لا يمكن الحذف الآن",
    blocked: [
      "وجود طلبات أو شحنات أو مدفوعات أو مستحقات أو عقود جارية.",
      "أن تكون مالك منشأة فيها أعضاء آخرون: أزلهم أولاً.",
      "أن تكون سائقاً ولديك رحلة جارية.",
    ],
    formTitle: "اطلب حذف حسابك",
    phoneLabel: "رقم الجوال المسجّل",
    phoneHint: "مثال: 0501234567 أو +201111346488",
    sendCode: "إرسال رمز التحقق",
    codeLabel: "رمز التحقق (6 أرقام)",
    codeSent: "إذا كان هذا الرقم مسجّلاً لدينا فقد أرسلنا إليه رمز التحقق. أدخله لتأكيد الحذف.",
    confirmDelete: "حذف حسابي نهائياً",
    confirmWarning: "لا يمكن التراجع بعد التأكيد.",
    working: "جارٍ التنفيذ…",
    doneTitle: "تم حذف حسابك",
    done: "تم إغلاق حسابك. شكراً لاستخدامك Logix.",
    invalidPhone: "أدخل رقم جوال صحيح.",
    invalidCode: "رمز التحقق غير صحيح أو منتهي.",
    tooMany: "محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.",
    failed: "تعذّر تنفيذ الطلب. حاول مرة أخرى.",
    back: "تغيير الرقم",
    otherLanguage: "English",
    contact: "للمساعدة تواصل معنا على",
  },
  en: {
    title: "Delete your account",
    intro: "You can ask for your Logix account and personal data to be deleted here, without opening the app. We send a verification code to your phone to confirm the account is yours.",
    whatTitle: "What happens when you delete",
    what: [
      "Your account is closed at once, all your sessions on every device end, and notifications stop.",
      "If you are the only owner of your organization, the organization closes with you and its products stop being shown.",
      "Your phone number and e-mail are released, so you can register with them again.",
      `After ${RETENTION_DAYS} days your identity is erased for good: name, phone number, e-mail and photo.`,
    ],
    keptTitle: "What we keep for the legal period",
    kept: [
      "Invoices, payments, payouts and contracts, because the law requires us to keep them.",
      "The record of your acceptance of the terms. After the erasure these records stay linked to an anonymous account.",
    ],
    blockedTitle: "When deletion is not possible yet",
    blocked: [
      "You have orders, shipments, payments, payouts or contracts in progress.",
      "You own an organization that has other members: remove them first.",
      "You are a driver with a trip in progress.",
    ],
    formTitle: "Request deletion",
    phoneLabel: "Registered phone number",
    phoneHint: "For example 0501234567 or +201111346488",
    sendCode: "Send verification code",
    codeLabel: "Verification code (6 digits)",
    codeSent: "If this number is registered with us, we have sent it a verification code. Enter it to confirm the deletion.",
    confirmDelete: "Delete my account permanently",
    confirmWarning: "This cannot be undone once confirmed.",
    working: "Working…",
    doneTitle: "Your account has been deleted",
    done: "Your account is closed. Thank you for using Logix.",
    invalidPhone: "Enter a valid phone number.",
    invalidCode: "The code is wrong or has expired.",
    tooMany: "Too many attempts. Please wait a moment and try again.",
    failed: "Could not complete the request. Please try again.",
    back: "Change number",
    otherLanguage: "العربية",
    contact: "For help contact us at",
  },
};
