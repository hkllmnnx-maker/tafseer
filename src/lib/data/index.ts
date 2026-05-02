// =============================================================================
// Data Access Layer — Entry Point
// =============================================================================
// نقطة الدخول الرسمية لطبقة الوصول إلى البيانات.
//
// الاستعمال (الموصى به في الصفحات الجديدة):
//   import { getDataProvider } from './lib/data'
//   const data = getDataProvider(c.env)        // c.env من Hono
//   const stats = await data.getStatsBasic()
//   const ayah  = await data.getAyah(1, 1)
//
// السلوك:
//   - إذا توفّر `env.DB` (binding D1 صحيح): يُرجَع D1 provider مع
//     fallback تلقائي إلى seed عند فشل أي استعلام.
//   - وإلا (Seed mode): يُرجَع seed provider الذي يقرأ من ذاكرة TS arrays.
//
// Note: D1 provider لا يستورد @cloudflare/workers-types مباشرة، يعتمد على
// تطابق بنيوي مع .prepare/.bind/.first/.all/.run.
// =============================================================================

import { seedProvider } from './seed-provider'
import { makeD1Provider, type D1Database } from './d1-provider'
import type { DataProvider, RequestEnv } from './types'

export type {
  DataProvider, RequestEnv, BasicStats, DetailedStatsLike,
} from './types'
export { seedProvider, makeD1Provider }

/**
 * هل الـ binding يبدو D1 حقيقيًا؟
 * نتحقّق فقط من وجود الدالة prepare لتجنّب الاستدعاء على كائن غير صحيح
 * (لو ضبط المستخدم binding خاطئ في wrangler.jsonc).
 */
function looksLikeD1(x: any): x is D1Database {
  return !!x && typeof x === 'object' && typeof x.prepare === 'function'
}

/**
 * يختار مزوّد البيانات المناسب بناءً على البيئة.
 *
 * @param env بيئة Cloudflare Pages من `c.env` في Hono.
 *            عند توفّر `DB` صحيح يُستعمل مزوّد D1، وإلا يُستعمل seed provider.
 *
 * @returns DataProvider جاهز للاستعمال (متزامن أو غير متزامن).
 */
export function getDataProvider(env?: RequestEnv): DataProvider {
  if (env && looksLikeD1((env as any).DB)) {
    try {
      return makeD1Provider((env as any).DB as D1Database)
    } catch {
      // أي خطأ في الإنشاء يسقط بهدوء إلى seed
      return seedProvider
    }
  }
  return seedProvider
}

/** اختصار للحصول على المزوّد الافتراضي بدون تمرير env. */
export function getDefaultDataProvider(): DataProvider {
  return seedProvider
}
