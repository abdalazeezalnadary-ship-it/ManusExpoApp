# إنشاء APK تجريبي عبر Expo EAS

يُنشأ ملف Android قابل للتثبيت عبر ملف `eas.json` في profile `preview`، مع `distribution: internal` و`android.buildType: apk`. هذا يوفّر ملف APK لمشاركته مباشرةً مع هاتف Android؛ ليس إصدار متجر ولا يتطلب وجود حساب مطور Google Play.

## حالة الربط والمتطلبات المتبقية

المشروع مربوط بالفعل بحساب Expo `abdalazeezalnadary` ومعرّف EAS محفوظ في `app.json`. تهيئة Android للـEAS نجحت وجرى التحقق من profile `preview`.

أنشئ Personal Access Token من [Expo Access tokens](https://expo.dev/settings/access-tokens)، وفعّل **Limit access** للحساب الشخصي الذي يملك المشروع بدور **Developer**. راجع [وثائق Expo للتوكنات والصلاحيات](https://docs.expo.dev/accounts/programmatic-access/)؛ الرمز سري ويجب عدم لصقه في Git أو المحادثة أو سجلات العمل. أضفه في GitHub تحت **Settings → Secrets and variables → Actions** باسم `EXPO_TOKEN`.

تم العثور على API Manus الحالي؛ استجاب `/api/health` بـ200 وأعاد استعلام المنيو 293 صنفاً قراءةً فقط. عنوانه تحويل لبيئة تطوير وليس استضافة إنتاج ثابتة، وقد يتوقف عند خمول الـSandbox. ضُبط متغير EAS `preview` باسم `EXPO_PUBLIC_API_URL` على هذا العنوان المؤقت. عنوان API قيمة عامة مضمّنة في التطبيق، وليس مفتاح اعتماد؛ راجع [وثائق متغيرات EAS](https://docs.expo.dev/eas/environment-variables/). للاستخدام طويل الأمد، انشر API وقاعدة البيانات على عنوان HTTPS ثابت ثم حدّث المتغير باستخدام `eas env:set --environment preview --name EXPO_PUBLIC_API_URL --value <HTTPS_URL> --type string --visibility plaintext`.

## تشغيل البناء

بعد إضافة `EXPO_TOKEN` كـSecret، افتح **Actions → Android APK → Run workflow** على الفرع `main`. يتحقق سير العمل من TypeScript والاختبارات، ويقرأ متغير `preview` من EAS ويتأكد من صحة `EXPO_PUBLIC_API_URL` واستجابة `/api/health` قبل إطلاق بناء `preview` الداخلي. يعرض EAS رابط صفحة البناء وAPK فقط عند النجاح. افتح رابط APK على الهاتف، نزّل الملف، واسمح بالتثبيت من المتصفح عند طلب Android ذلك.

لم يبدأ بناء APK بعد لأن تعذر التحقق من وجود GitHub Secret بسبب صلاحية الموصل، كما أن عنوان API الحالي مؤقت. لم تحفظ مفاتيح توقيع Android في المصدر؛ يتولى EAS إعداد بيانات التوقيع عند البناء.

## المصادر

- تشرح وثائق Expo الرسمية ربط المشروع عبر `eas init` وإعداد EAS Build: [1] [2].
- توضح وثائق APK خصائص `internal` و`android.buildType: apk` والتنزيل المباشر على الجهاز: [3].
- توثق Expo استخدام `EXPO_TOKEN` في بيئات CI مثل GitHub Actions: [4].

[1]: https://docs.expo.dev/tutorial/eas/configure-development-build/ "Configure and link an Expo project"
[2]: https://docs.expo.dev/build/setup/ "Create the first EAS build"
[3]: https://docs.expo.dev/build-reference/apk/ "Build and install Android APKs"
[4]: https://docs.expo.dev/build/building-on-ci/ "Trigger EAS Build from CI"
