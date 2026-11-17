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

1. اربط المشروع بحساب Expo مرة واحدة من مجلد المشروع باستخدام `pnpm dlx eas-cli@latest init` ثم احفظ `extra.eas.projectId` الذي يضيفه EAS في `app.json` وادفع التغيير.
2. أضف رمز Expo كـGitHub Repository Secret اسمه `EXPO_TOKEN`؛ لا تكتبه في ملف أو سجل أو محادثة.
3. اضبط `EXPO_PUBLIC_API_URL` في بيئة بناء Expo على عنوان API الحقيقي. قيمة URL ليست مفتاحاً سرياً، لكن يجب أن تكون عنواناً صالحاً يمكن للهاتف الوصول إليه.
4. شغّل Workflow **Android APK** يدوياً. عند اكتمال EAS ستظهر نتيجة البناء ورابط APK في سجلات المهمة/لوحة Expo.

لم يُنشأ رابط APK في هذه النسخة لأن حساب Expo ورمز البناء ومعرّف مشروع EAS وعنوان API العام غير متوفرة في هذه الجلسة. إعداد `eas.json` يجهز ملف البناء فقط ولا يعني أن بناءً قد نجح.

## أوامر مفيدة

```bash
pnpm check       # TypeScript
pnpm test        # اختبارات السياسات وسلامة المنيو
pnpm build:web   # تصدير نسخة الويب
pnpm build:server # تجميع API
```

تفاصيل خطوات EAS في [`docs/EAS_BUILDING.md`](docs/EAS_BUILDING.md)، ومواصفات المنتج والبيانات والحدود المقصودة في [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md). لا تفعّل Stripe أو Firestore أو Gemini قبل إعدادها بشكل منفصل.
