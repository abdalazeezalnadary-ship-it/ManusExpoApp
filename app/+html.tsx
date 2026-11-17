import type { PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="description" content="مطاعم دريم سيتي — الطلب والمتابعة وإدارة تشغيل الفروع باللغة العربية." />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>مطاعم دريم سيتي</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/dreamcity-192.png" />
        <link rel="apple-touch-icon" href="/icons/dreamcity-192.png" />
      </head>
      <body>
        <ScrollViewStyleReset />
        {children}
      </body>
    </html>
  );
}
