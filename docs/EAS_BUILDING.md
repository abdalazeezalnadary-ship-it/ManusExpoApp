# إنشاء APK تجريبي عبر Expo EAS

يُنشأ ملف Android قابل للتثبيت عبر ملف `eas.json` في profile `preview`، مع `distribution: internal` و`android.buildType: apk`. هذا يوفّر ملف APK لمشاركته مباشرةً مع هاتف Android؛ ليس إصدار متجر ولا يتطلب وجود حساب مطور Google Play.

## حالة الربط والمتطلبات المتبقية

المشروع مربوط بالفعل بحساب Expo `abdalazeezalnadary` ومعرّف EAS محفوظ في `app.json`. تهيئة Android للـEAS نجحت وجرى التحقق من profile `preview`.

أنشئ Personal Access Token من [Expo Access tokens](https://expo.dev/settings/access-tokens)، وفعّل **Limit access** للحساب الشخصي الذي يملك المشروع بدور **Developer**. هذه الصلاحية تكفي لإنشاء builds وإدارة بيانات البناء، والرمز نفسه يظل سرياً؛ لا تلصقه في Git أو المحادثة أو سجلات العمل. أضفه في GitHub تحت **Settings → Secrets and variables → Actions** باسم `EXPO_TOKEN`.

لا يوجد حالياً API عام منشور لهذا المستودع. بعد نشر الـAPI وقاعدة البيانات على HTTPS، أضف عنوان API الأساسي كـGitHub repository variable باسم `EXPO_PUBLIC_API_URL`. عنوان API قيمة عامة تُضمّن في التطبيق، وليس مفتاح اعتماد. يتحقق الـworkflow من استجابة `https://<host>/api/health`، ثم يزامن القيمة إلى متغير EAS `preview` من النوع `plaintext` قبل طلب البناء. لا تستخدم `localhost` أو `10.0.2.2` لهاتف فعلي.

## تشغيل البناء

بعد إضافة `EXPO_TOKEN` كـSecret و`EXPO_PUBLIC_API_URL` كـVariable، افتح **Actions → Android APK → Run workflow** على الفرع `main`. يتحقق سير العمل من TypeScript والاختبارات، ومن عنوان API وفحص صحته، ثم يزامنه إلى EAS ويطلق بناء `preview` الداخلي. يعرض EAS رابط صفحة البناء وAPK فقط عند النجاح. افتح رابط APK على الهاتف، نزّل الملف، واسمح بالتثبيت من المتصفح عند طلب Android ذلك.

لم يبدأ بناء APK بعد لأن عنوان API العام وGitHub Secret لم يجهزا. لم تحفظ مفاتيح توقيع Android في المصدر؛ يتولى EAS إعداد بيانات التوقيع عند البناء.

## المصادر

- تشرح وثائق Expo الرسمية ربط المشروع عبر `eas init` وإعداد EAS Build: [1] [2].
- توضح وثائق APK خصائص `internal` و`android.buildType: apk` والتنزيل المباشر على الجهاز: [3].
- توثق Expo استخدام `EXPO_TOKEN` في بيئات CI مثل GitHub Actions: [4].

[1]: https://docs.expo.dev/tutorial/eas/configure-development-build/ "Configure and link an Expo project"
[2]: https://docs.expo.dev/build/setup/ "Create the first EAS build"
[3]: https://docs.expo.dev/build-reference/apk/ "Build and install Android APKs"
[4]: https://docs.expo.dev/build/building-on-ci/ "Trigger EAS Build from CI"
