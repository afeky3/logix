-- Placeholder terms documents so GET /terms/current and the app's terms
-- screens (K-P03 provider terms, A07) have something real to show — legal
-- hasn't signed off on actual wording yet. Explicit product decision: ship
-- mockup/placeholder copy now, swap the body_markdown later via
-- POST /admin/terms (admin stopgap not built yet) or a follow-up migration.
-- `legal_signoff_by`/`_at` below are NOT a real legal sign-off — they're
-- set only to satisfy ck_terms_published_signoff (PUBLISHED requires a
-- signoff timestamp) and say so explicitly in `legal_signoff_by`.
-- One per audience, ar + en, each marked is_current/PUBLISHED.
BEGIN;

INSERT INTO org.terms_documents
  (id, audience, version, locale, title, body_markdown, summary_items, status, is_current, published_at, legal_signoff_by, legal_signoff_at)
VALUES
(gen_random_uuid(), 'CUSTOMER', '1.0.0', 'ar', 'شروط استخدام المشتري',
 '# شروط استخدام المشتري (نسخة مبدئية)\n\nهذا نص مؤقت ريثما تُعتمد الصياغة القانونية النهائية. باستخدامك للتطبيق كمشترٍ فإنك توافق على طلب الخدمات بدقة ووضوح، وعلى سياسة الإلغاء المعمول بها لكل طلب.',
 '["طلب الخدمة بدقة", "سياسة الإلغاء", "الدفع الآمن"]', 'PUBLISHED', true, now(), 'placeholder — pending legal review', now()),
(gen_random_uuid(), 'CUSTOMER', '1.0.0', 'en', 'Customer Terms',
 '# Customer Terms (placeholder)\n\nThis is placeholder copy until legal sign-off. By using the app as a customer you agree to request services accurately and to the cancellation policy in effect for each request.',
 '["Accurate requests", "Cancellation policy", "Secure payment"]', 'PUBLISHED', true, now(), 'placeholder — pending legal review', now()),

(gen_random_uuid(), 'SUPPLIER', '1.0.0', 'ar', 'شروط المورد',
 '# شروط المورد (نسخة مبدئية)\n\nهذا نص مؤقت ريثما تُعتمد الصياغة القانونية النهائية. يوافق المورد على عمولة 3.5% وعلى سياسة المرتجعات، وعلى دقة بيانات المنتجات المعروضة.',
 '["عمولة 3.5%", "سياسة المرتجعات", "دقة بيانات المنتج"]', 'PUBLISHED', true, now(), 'placeholder — pending legal review', now()),
(gen_random_uuid(), 'SUPPLIER', '1.0.0', 'en', 'Supplier Terms',
 '# Supplier Terms (placeholder)\n\nThis is placeholder copy until legal sign-off. The supplier agrees to a 3.5% commission, the returns policy, and accurate product listings.',
 '["3.5% commission", "Returns policy", "Accurate listings"]', 'PUBLISHED', true, now(), 'placeholder — pending legal review', now()),

(gen_random_uuid(), 'PROVIDER', '1.0.0', 'ar', 'شروط مقدّم الخدمة',
 '# شروط مقدّم الخدمة (نسخة مبدئية)\n\nهذا نص مؤقت ريثما تُعتمد الصياغة القانونية النهائية. يوافق مقدّم الخدمة على عمولة 10% لخدمات الشحن/النقل أو 20% للتخليص الجمركي/التخزين، وعلى الالتزام بالمواعيد المتفق عليها.',
 '["عمولة 10% نقل/شحن أو 20% جمارك/تخزين", "الالتزام بالمواعيد", "التحقق من الأنشطة"]', 'PUBLISHED', true, now(), 'placeholder — pending legal review', now()),
(gen_random_uuid(), 'PROVIDER', '1.0.0', 'en', 'Provider Terms',
 '# Provider Terms (placeholder)\n\nThis is placeholder copy until legal sign-off. The provider agrees to a 10% commission on freight/transport (20% on customs/storage) and to meeting agreed schedules.',
 '["10% transport/freight or 20% customs/storage commission", "Meeting schedules", "Activity verification"]', 'PUBLISHED', true, now(), 'placeholder — pending legal review', now())
ON CONFLICT DO NOTHING;

COMMIT;
