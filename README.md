# مطاعم دريم سيتي

تطبيق Expo متعدد الفروع باللغة العربية وواجهة RTL، مع تطبيق عميل وواجهات تشغيل، وAPI مستقل من Express/tRPC، وقاعدة بيانات MySQL عبر Drizzle.

## المتطلبات

- Node.js 22 أو أحدث وpnpm 9.
- Docker مع Docker Compose لتشغيل MySQL محلياً.
- حساب Expo وربط EAS مطلوبان لبناء APK على السحابة.

## تشغيل محلي

```bash
pnpm install
cp .env.example .env
```

حرّر `.env` محلياً فقط: عيّن `MYSQL_PASSWORD` و`MYSQL_ROOT_PASSWORD` و`JWT_SECRET` (سر عشوائي طويل لا يقل عن 32 حرفاً، ويمكن توليده بـ`openssl rand -hex 32`)، ثم ضع `DATABASE_URL` بالشكل التالي مع كلمة المرور المحلية نفسها:

```text
mysql://dreamcity_app:<MYSQL_PASSWORD>@127.0.0.1:3306/dreamcity
```

لتشغيل قاعدة البيانات ثم إعداد المخطط والمنيو:

```bash
docker compose up -d db
pnpm db:push
pnpm seed:menu
```

ثم شغّل API والويب معاً:

```bash
pnpm dev
```

- الويب: `http://localhost:8081`
- فحص API: `http://localhost:3000/api/health`

يمكن تشغيل التطبيق على Android emulator عبر `pnpm android`. على محاكي Android يوجّه التطبيق تلقائياً إلى `10.0.2.2:3000`. للهاتف الحقيقي، عيّن `EXPO_PUBLIC_API_URL` إلى عنوان API يمكن للهاتف الوصول إليه؛ في شبكة محلية استخدم عنوان الحاسوب، وللبناء على EAS استخدم عنوان HTTPS متاحاً للهاتف.

## حساب المدير الاختياري

لا يتضمن المستودع أي حساب موظف أو كلمة مرور افتراضية. لإنشاء مدير اختبار محلياً فقط، أدخل `INITIAL_ADMIN_NAME` و`INITIAL_ADMIN_PHONE` و`INITIAL_ADMIN_PASSWORD` في `.env` (كلمة المرور 10 أحرف على الأقل)، ثم شغّل:

```bash
pnpm seed:admin
```

لا يطبع البرنامج كلمة المرور ولا يحفظها في Git. يُخزن hash فقط، ويُفرض تغيير كلمة المرور عند أول تسجيل دخول. لا تشغّل هذا على قاعدة إنتاجية دون مراجعة واعتماد مالك النظام.

## بناء APK تجريبي

ملف `eas.json` يحتوي profile داخلياً باسم `preview` ينتج APK. يوجد سير عمل يدوي في GitHub Actions باسم **Android APK**. قبل تشغيله:

1. المشروع مربوط بالفعل بحساب Expo `abdalazeezalnadary`، ومعرّفه محفوظ في `app.json`.
2. أنشئ Personal Access Token في لوحة Expo وقيّده بحساب المشروع وبصلاحية Developer، ثم أضفه في GitHub: **Settings → Secrets and variables → Actions → New repository secret** باسم `EXPO_TOKEN`. لا تضع الرمز في ملف أو سجل أو محادثة.
3. متغير EAS `preview` باسم `EXPO_PUBLIC_API_URL` مضبوط حالياً على API Manus المؤقت، وقد اجتاز فحص الصحة وقراءة المنيو. هذا عنوان تحويل لبيئة تطوير وقد يتوقف عند خمول البيئة؛ للاختبار الموثوق طويل الأمد، انشر API وقاعدة بيانات على HTTPS ثابت وحدّث متغير EAS، ولا تضعه في GitHub Secret.
4. بعد إضافة سر `EXPO_TOKEN` والتأكد أن API يعمل، شغّل Workflow **Android APK** يدوياً من الفرع `main`. يقرأ الـworkflow متغير API من EAS ويتحقق من `/api/health` قبل البناء. عند اكتمال EAS ستظهر نتيجة البناء ورابط APK.

لم يبدأ بناء APK بعد؛ لم يمكن التحقق من وجود GitHub Secret بسبب صلاحية GitHub الحالية. لا تختبر طلبات كتابة على قاعدة البيانات الحية إلا بعد موافقتك، لأن طلبات الاختبار قد تُسجل فيها بيانات فعلية.

## أوامر مفيدة

```bash
pnpm check       # TypeScript
pnpm test        # اختبارات السياسات وسلامة المنيو
pnpm build:web   # تصدير نسخة الويب
pnpm build:server # تجميع API
```

تفاصيل خطوات EAS في [`docs/EAS_BUILDING.md`](docs/EAS_BUILDING.md)، ومواصفات المنتج والبيانات والحدود المقصودة في [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md). لا تفعّل Stripe أو Firestore أو Gemini قبل إعدادها بشكل منفصل.
