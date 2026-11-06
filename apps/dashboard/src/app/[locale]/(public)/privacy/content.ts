// Privacy policy text, kept here rather than in messages/*.json because it is
// long-form legal copy that changes as a whole. Describe what the code actually
// does: when data collection, storage or retention changes, update this file
// and LAST_UPDATED.

export const LAST_UPDATED = "2026-11-06";
// Same address the app shows (backend app-config supportContacts).
export const CONTACT_EMAIL = "support@logix.sa";

export interface PolicySection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface PolicyContent {
  title: string;
  updatedLabel: string;
  intro: string;
  sections: PolicySection[];
  otherLanguage: string;
}

export const policy: Record<"ar" | "en", PolicyContent> = {
  ar: {
    title: "سياسة الخصوصية",
    updatedLabel: "آخر تحديث",
    intro:
      "توضح هذه السياسة كيف تجمع منصة Logix (التطبيق والموقع logix-co.com) بياناتك الشخصية وتستخدمها وتحفظها وتحميها، وما حقوقك تجاهها. باستخدامك للمنصة فإنك توافق على ما ورد في هذه السياسة.",
    sections: [
      {
        title: "البيانات التي نجمعها",
        items: [
          "بيانات الحساب: رقم الجوال (للدخول برمز التحقق)، والاسم، والبريد الإلكتروني، وكلمة المرور إن أنشأتها (تُحفظ مشفّرة بطريقة لا يمكن استرجاعها)، والصورة الشخصية.",
          "بيانات المنشأة: اسم المنشأة ونوعها، ورقم السجل التجاري، والرقم الضريبي، ورقم الآيبان للتحويلات (يُحفظ مشفّراً)، والوثائق التي ترفعها للتحقق.",
          "العناوين والموقع: عناوين الاستلام والتسليم واسم ورقم جهة الاتصال. نستخدم موقعك الجغرافي فقط عندما تختار عنواناً على الخريطة وبعد إذنك، ولا نتتبع موقعك في الخلفية.",
          "بيانات التعامل: الطلبات والشحنات وعروض الأسعار والمنتجات والعقود والفواتير والمدفوعات وإيصالات التحويل البنكي والمسترجعات والتسويات.",
          "المحادثات والملفات: الرسائل بينك وبين الأطراف الأخرى في الطلب، بما فيها الصور والملفات والرسائل الصوتية التي ترسلها.",
          "بيانات الجهاز والاستخدام: عنوان IP ونوع الجهاز والمتصفح ورمز الإشعارات وسجلات الدخول، وتقارير الأعطال التقنية لتحسين استقرار التطبيق.",
        ],
      },
      {
        title: "أذونات التطبيق",
        items: [
          "الموقع: لتحديد عناوين الاستلام والتسليم على الخريطة.",
          "الكاميرا والصور: لرفع الصورة الشخصية والوثائق وصور الشحنات والمحادثات.",
          "الميكروفون: لتسجيل الرسائل الصوتية في المحادثات فقط.",
          "الإشعارات: لإبلاغك بتحديثات الطلبات والرسائل والمدفوعات.",
        ],
        paragraphs: ["يمكنك رفض أي إذن أو إلغاؤه من إعدادات جهازك، وقد تتوقف الميزة المرتبطة به فقط."],
      },
      {
        title: "كيف نستخدم بياناتك",
        items: [
          "إنشاء حسابك والتحقق من هويتك وتأمين الدخول.",
          "تشغيل خدمات المنصة: ربطك بمقدمي الخدمات والموردين والعملاء، وتنفيذ الطلبات والشحنات والتخليص الجمركي.",
          "التحقق من المنشآت ومراجعة الوثائق والتحويلات البنكية ومنع الاحتيال.",
          "إصدار الفواتير وتسوية المستحقات والوفاء بالالتزامات النظامية والمحاسبية.",
          "إرسال رموز التحقق والإشعارات المتعلقة بحسابك وطلباتك.",
          "الدعم الفني وحل النزاعات وتحسين المنصة.",
        ],
        paragraphs: ["لا نبيع بياناتك الشخصية، ولا نستخدمها للإعلانات الموجّهة."],
      },
      {
        title: "مع من نشارك بياناتك",
        items: [
          "أطراف الطلب: يرى الطرف الآخر في الطلب (العميل أو مقدم الخدمة أو المورد) ما يلزم لتنفيذه، مثل اسم المنشأة والعنوان وجهة الاتصال.",
          "مزودو الخدمات التقنية: نستخدم واتساب لإرسال رموز التحقق، وخدمات Google Firebase للإشعارات وتقارير الأعطال، وخدمات الخرائط لعرض العناوين. يحصل كل منهم على ما يلزم لأداء خدمته فقط.",
          "الجهات الرسمية: عندما يطلب ذلك نظام أو أمر قضائي أو جهة مختصة.",
        ],
      },
      {
        title: "حماية البيانات",
        paragraphs: [
          "تنتقل البيانات بين التطبيق وخوادمنا مشفّرة (HTTPS). تُحفظ كلمات المرور ورموز التحقق بتجزئة لا يمكن عكسها، ويُشفّر رقم الآيبان. لا يمكن الوصول إلى الملفات المرفوعة إلا لمن له صلاحية عليها، ويقتصر وصول فريقنا على ما تتطلبه مهامه وتُسجَّل عملياته.",
        ],
      },
      {
        title: "مدة الاحتفاظ بالبيانات",
        items: [
          "نحتفظ ببيانات حسابك طوال فترة نشاطه.",
          "عند حذف الحساب يتوقف فوراً ويُخفى عن المستخدمين، ويُحرَّر رقم جوالك وبريدك. وخلال 30 يوماً نحذف نهائياً اسمك ورقم جوالك وبريدك الإلكتروني وصورتك وبيانات ملفك الشخصي.",
          "نحتفظ بالفواتير والمدفوعات والطلبات المكتملة والعقود للمدة التي تفرضها الأنظمة المحاسبية والضريبية (حتى 10 سنوات)، مرتبطة بسجل مجهول لا يحمل بياناتك الشخصية.",
          "نحتفظ بسجلات الأمان والتدقيق للمدة اللازمة لحماية المنصة والوفاء بالالتزامات النظامية.",
        ],
      },
      {
        title: "حقوقك",
        items: [
          "الاطلاع على بياناتك وتصحيحها من إعدادات حسابك في التطبيق.",
          "طلب نسخة من بياناتك أو الاعتراض على معالجتها بمراسلتنا.",
          "حذف حسابك من التطبيق (الحساب ← حذف الحساب) أو من صفحة حذف الحساب على موقعنا.",
          "إيقاف الإشعارات من إعدادات جهازك.",
        ],
        paragraphs: ["نعالج بياناتك وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية."],
      },
      {
        title: "الأطفال",
        paragraphs: ["المنصة موجّهة للأعمال وليست للأطفال، ولا نجمع عن قصد بيانات من هم دون 18 عاماً."],
      },
      {
        title: "التغييرات على هذه السياسة",
        paragraphs: [
          "قد نحدّث هذه السياسة من وقت لآخر، وسننشر النسخة المحدّثة في هذه الصفحة مع تاريخ آخر تحديث، ونبلغك داخل التطبيق إذا كان التغيير جوهرياً.",
        ],
      },
      {
        title: "تواصل معنا",
        paragraphs: ["لأي سؤال أو طلب يتعلق بخصوصيتك راسلنا على:"],
      },
    ],
    otherLanguage: "English",
  },
  en: {
    title: "Privacy Policy",
    updatedLabel: "Last updated",
    intro:
      "This policy explains how the Logix platform (the app and the logix-co.com website) collects, uses, stores and protects your personal data, and what rights you have over it. By using the platform you agree to this policy.",
    sections: [
      {
        title: "Data we collect",
        items: [
          "Account data: your mobile number (used to sign in with a verification code), name, email address, password if you set one (stored as a one-way hash), and profile photo.",
          "Business data: business name and type, commercial registration number, VAT number, IBAN for transfers (stored encrypted), and the documents you upload for verification.",
          "Addresses and location: pickup and delivery addresses and their contact name and number. We use your location only when you pick an address on the map, with your permission, and never track it in the background.",
          "Transaction data: orders, shipments, quotes, products, contracts, invoices, payments, bank-transfer receipts, refunds and settlements.",
          "Messages and files: messages between you and the other parties to an order, including the images, files and voice notes you send.",
          "Device and usage data: IP address, device and browser type, push-notification token, sign-in records, and technical crash reports that help keep the app stable.",
        ],
      },
      {
        title: "App permissions",
        items: [
          "Location: to set pickup and delivery addresses on the map.",
          "Camera and photos: to upload your profile photo, documents, shipment photos and chat images.",
          "Microphone: only to record voice messages in chat.",
          "Notifications: to tell you about order, message and payment updates.",
        ],
        paragraphs: ["You can refuse or revoke any permission in your device settings; only the related feature stops working."],
      },
      {
        title: "How we use your data",
        items: [
          "To create your account, verify your identity and secure sign-in.",
          "To run the platform: connecting you with service providers, suppliers and customers, and carrying out orders, shipments and customs clearance.",
          "To verify businesses, review documents and bank transfers, and prevent fraud.",
          "To issue invoices, settle payouts and meet legal and accounting obligations.",
          "To send verification codes and notifications about your account and orders.",
          "To provide support, resolve disputes and improve the platform.",
        ],
        paragraphs: ["We do not sell your personal data and do not use it for targeted advertising."],
      },
      {
        title: "Who we share it with",
        items: [
          "Parties to an order: the other side of an order (customer, service provider or supplier) sees what is needed to fulfil it, such as business name, address and contact details.",
          "Technical service providers: WhatsApp to deliver verification codes, Google Firebase for notifications and crash reports, and map services to display addresses. Each receives only what its service needs.",
          "Authorities: when required by law, a court order or a competent authority.",
        ],
      },
      {
        title: "How we protect it",
        paragraphs: [
          "Data travels between the app and our servers encrypted (HTTPS). Passwords and verification codes are stored as one-way hashes, and IBANs are encrypted. Uploaded files are served only to people authorized to see them, and our staff's access is limited to what their role requires and is logged.",
        ],
      },
      {
        title: "How long we keep it",
        items: [
          "We keep your account data while your account is active.",
          "When you delete your account it stops working immediately, is hidden from other users, and your mobile number and email are released. Within 30 days we permanently remove your name, mobile number, email, photo and profile data.",
          "Invoices, payments, completed orders and contracts are kept for the period accounting and tax laws require (up to 10 years), linked to an anonymous record that carries none of your personal data.",
          "Security and audit logs are kept as long as needed to protect the platform and meet legal obligations.",
        ],
      },
      {
        title: "Your rights",
        items: [
          "View and correct your data from your account settings in the app.",
          "Request a copy of your data, or object to its processing, by contacting us.",
          "Delete your account in the app (Account → Delete account) or from the account deletion page on our website.",
          "Turn off notifications in your device settings.",
        ],
        paragraphs: ["We process your data in line with the Personal Data Protection Law of the Kingdom of Saudi Arabia."],
      },
      {
        title: "Children",
        paragraphs: ["The platform is built for businesses, not children, and we do not knowingly collect data from anyone under 18."],
      },
      {
        title: "Changes to this policy",
        paragraphs: [
          "We may update this policy from time to time. The current version is always on this page with its last-updated date, and we will tell you in the app if a change is significant.",
        ],
      },
      {
        title: "Contact us",
        paragraphs: ["For any question or request about your privacy, email us at:"],
      },
    ],
    otherLanguage: "العربية",
  },
};
