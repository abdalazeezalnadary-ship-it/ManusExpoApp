# إنشاء APK تجريبي عبر Expo EAS

يُنشأ ملف Android قابل للتثبيت عبر ملف `eas.json` في profile `preview`، مع `distribution: internal` و`android.buildType: apk`. هذا يوفّر ملف APK لمشاركته مباشرةً مع هاتف Android؛ ليس إصدار متجر ولا يتطلب وجود حساب مطور Google Play.

## الإعداد الأول مرة واحدة

من مجلد المشروع، باستخدام حساب Expo المالك:

```bash
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest init
```

ينشئ `eas init` مشروع EAS ويربطه بتكوين Expo المحلي؛ يضيف `owner` و`extra.eas.projectId` إلى `app.json`. احفظ هذه التغييرات وادفعها إلى الفرع `main`. ثم أضف Personal Access Token كـGitHub Repository Secret اسمه `EXPO_TOKEN` فقط؛ لا تضف الرمز في `app.json` أو `.env.example` أو الشيفرة أو المحادثة.

يجب أن يتوفر عنوان API يستطيع الهاتف الوصول إليه. عيّن `EXPO_PUBLIC_API_URL` في بيئة بناء Expo للـprofile `preview` إلى عنوان HTTPS للخادم الفعلي. هذه قيمة إعداد عامة وليست مفتاح اعتماد. لا يُستخدم `localhost` أو `10.0.2.2` على هاتف فعلي.

## تشغيل البناء

في GitHub افتح **Actions → Android APK → Run workflow** على الفرع `main`. ينفذ سير العمل تثبيت الاعتماديات وفحوص TypeScript والاختبارات ثم يطلق EAS بالبناء الداخلي `preview`. يعرض EAS رابط صفحة البناء وملف APK بعد النجاح. افتح رابط APK على الهاتف، نزّل الملف، واسمح بالتثبيت من المتصفح عند طلب Android ذلك.

لا يدّعي هذا المستودع أن APK قد بُني بالفعل؛ يلزم أولاً ربط EAS وتوفير الرمز وعنوان API. لا تحفظ مفاتيح توقيع Android في GitHub source؛ يسمح EAS بإدارة بيانات توقيع Android اللازمة للبناء.

## المصادر

- تشرح وثائق Expo الرسمية ربط المشروع عبر `eas init` وإعداد EAS Build: [1] [2].
- توضح وثائق APK خصائص `internal` و`android.buildType: apk` والتنزيل المباشر على الجهاز: [3].
- توثق Expo استخدام `EXPO_TOKEN` في بيئات CI مثل GitHub Actions: [4].

[1]: https://docs.expo.dev/tutorial/eas/configure-development-build/ "Configure and link an Expo project"
[2]: https://docs.expo.dev/build/setup/ "Create the first EAS build"
[3]: https://docs.expo.dev/build-reference/apk/ "Build and install Android APKs"
[4]: https://docs.expo.dev/build/building-on-ci/ "Trigger EAS Build from CI"
