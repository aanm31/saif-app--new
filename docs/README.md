# صيف عبدالرحمن بن ناصر 48

منصة تعليمية ترفيهية للأطفال، منشورة عبر Cloudflare Workers مع Static Assets وD1 وتسجيل دخول حقيقي.

## إعداد Cloudflare

1. اربط المستودع بالـ Worker المسمى `saif-app`.
2. أنشئ قاعدة D1 وطبّق ملف `schema.sql` من لوحة D1.
3. من Settings > Bindings أضف D1 binding باسم `DB`.
4. من Settings > Variables and Secrets أضف سرًا باسم `SETUP_TOKEN` وقيمة طويلة عشوائية.
5. استخدم أمر البناء `npm install` وأمر النشر `npm run deploy`، ثم افتح `/setup.html` مرة واحدة لإنشاء حساب المالك.

طلبات التسجيل والحسابات والجلسات والنقاط تُحفظ في D1، وكلمات المرور تُشتق باستخدام PBKDF2 ولا تُحفظ كنص صريح.
