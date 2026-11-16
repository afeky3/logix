// Platform terms shown at logix-co.com/{ar,en}/terms. This is the text the app asks people to accept
// (the `legalPlatform*` strings in logic-app/lib/l10n, version below): keep the two in step, and bump
// TERMS_VERSION in both when it changes. Generated from the app's strings on 2026-11-16.

export const TERMS_VERSION = "2026-11-06";

export interface TermsSection {
  title: string;
  body: string;
}

export interface TermsContent {
  title: string;
  intro: string;
  otherLanguage: string;
  versionLabel: string;
  privacyLabel: string;
  sections: TermsSection[];
}

export const terms: Record<"ar" | "en", TermsContent> = {
  "ar": {
    "title": "الشروط والأحكام",
    "intro": "تحكم هذه الشروط استخدامك لمنصة Logix (التطبيق والموقع logix-co.com). باستخدامك للمنصة أو بتسجيل حسابك فإنك توافق عليها.",
    "otherLanguage": "English",
    "versionLabel": "إصدار الشروط",
    "privacyLabel": "سياسة الخصوصية",
    "sections": [
      {
        "title": "دور منصة لوجكس",
        "body": "منصة لوجكس وسيط تقني وخدمي فقط، لتسهيل المعاملات التجارية بين المنشآت (B2B) وتوثيقها. المنصة ليست مصنعاً، وليست بائعاً مباشراً، ولا تملك السلع المعروضة عليها. ويقتصر دورها على تقديم خدمات الوساطة التقنية، وإدارة حساب الضمان (Escrow)، والشحن."
      },
      {
        "title": "حدود المسؤولية",
        "body": "لا تتحمل المنصة أي مسؤولية قانونية أو تجارية أو مالية عن جودة المنتجات، أو عيوب التصنيع، أو مطابقة المواصفات، أو تأخر التسليم من قِبل المصانع أو الشركات المعروضة منتجاتها على المنصة."
      },
      {
        "title": "الاسترجاع والاستبدال",
        "body": "يحدد كل مصنع أو شركة عارضة (Vendor) سياسة الاسترجاع والاستبدال الخاصة به، وتظهر للمشتري بوضوح قبل إتمام الطلب. ويقر المشتري بموافقته على سياسة الاسترجاع الخاصة بالمورد البائع حصراً، ولا تتدخل المنصة في قبول المرتجعات أو رفضها إلا في حدود النزاعات المالية المعلقة في حساب الضمان، وبما يتوافق مع شروط المورد المعلنة."
      },
      {
        "title": "حساب الضمان وشروط الدفع",
        "body": "تُعد منصة لوجكس منفذاً تقنياً ومحفظة وسيطة (Escrow) لتنفيذ شروط الدفع التي يحددها البائع ويوافق عليها المشتري صراحةً. ولا تتحمل المنصة مسؤولية أي نزاع مالي ينشأ عن الإخلال بشروط الدفع المتفق عليها خارج نطاق المنصة أو بعد تسليم المستندات."
      },
      {
        "title": "توثيق الموافقة",
        "body": "عند موافقتك نسجّل تاريخ ووقت الموافقة، وعنوان الـ IP، ورقم الهوية أو السجل التجاري المسجّل في حسابك، لتكون حجة قانونية رقمية موثقة على هذه الاتفاقية."
      },
      {
        "title": "سياسة الإلغاء",
        "body": "مجاني مع استرداد كامل المبلغ قبل أن يقبل مقدم الخدمة الطلب. بعد القبول وقبل وصول الناقل تُخصم 10% من قيمة الخدمة. بعد وصول الناقل أو بدء الإجراءات تُخصم 25%. بعد استلام الشحنة وبدء التنفيذ تُخصم 100%."
      }
    ]
  },
  "en": {
    "title": "Terms and Conditions",
    "intro": "These terms govern your use of the Logix platform (the app and logix-co.com). By using the platform or registering an account you accept them.",
    "otherLanguage": "العربية",
    "versionLabel": "Terms version",
    "privacyLabel": "Privacy policy",
    "sections": [
      {
        "title": "The role of Logix",
        "body": "Logix is a technical and service intermediary only, built to facilitate and document business-to-business (B2B) transactions. Logix is not a manufacturer, is not a direct seller and does not own the goods listed on it. Its role is limited to technical intermediation, managing the escrow account, and shipping."
      },
      {
        "title": "Limitation of liability",
        "body": "Logix bears no legal, commercial or financial liability for product quality, manufacturing defects, conformity with specifications, or late delivery by the factories or companies whose products are listed on the platform."
      },
      {
        "title": "Returns and exchanges",
        "body": "Every factory or company listing products (vendor) sets its own return and exchange policy, which is shown to the buyer before the order is placed. The buyer accepts the selling vendor's policy exclusively. Logix does not decide on accepting or rejecting returns, except within financial disputes pending in the escrow account and in line with the vendor's published terms."
      },
      {
        "title": "Escrow and payment terms",
        "body": "Logix acts as a technical channel and an intermediary wallet (escrow) that executes the payment terms set by the seller and explicitly accepted by the buyer. Logix is not responsible for any financial dispute arising from a breach of payment terms agreed outside the platform, or after the documents have been delivered."
      },
      {
        "title": "How your acceptance is recorded",
        "body": "When you accept, we record the date and time, your IP address, and the ID or commercial registration number on your account, as documented digital evidence of this agreement."
      },
      {
        "title": "Cancellation policy",
        "body": "Free, with a full refund, before the provider accepts the order. After acceptance and before the carrier arrives, 10% of the service value is deducted. After the carrier arrives or procedures begin, 25%. After the shipment is received and work starts, 100%."
      }
    ]
  }
};
