// Reusable badge components for displaying scientific verification metadata.
// Centralised so badge styling stays consistent across the verse, search,
// reading, and comparison pages.
import {
  getSourceTypeMeta, getVerificationMeta, isWarningStatus,
  type SourceType, type VerificationStatus,
} from '../../lib/scientific'
import { IconShield, IconQuote } from '../icons'

export const SourceTypeBadge = ({ type }: { type: SourceType | undefined }) => {
  const m = getSourceTypeMeta(type)
  return (
    <span class={`badge tafseer-badge ${m.cssClass}`} title={m.description}>
      <IconQuote size={11} /> {m.label}
    </span>
  )
}

export const VerificationBadge = ({ status }: { status: VerificationStatus | undefined }) => {
  const m = getVerificationMeta(status)
  return (
    <span class={`badge tafseer-badge ${m.cssClass}`} title={m.description}>
      <IconShield size={11} /> {m.label}
    </span>
  )
}

export const VerificationWarning = ({ status, note }: { status?: VerificationStatus; note?: string }) => {
  if (!isWarningStatus(status) && !note) return null
  const m = getVerificationMeta(status)
  return (
    <div class="scientific-warning" role="note">
      <strong>{m.label}:</strong>
      <span> {note || m.description}</span>
      <a href="/methodology" class="text-accent" style="margin-inline-start:.4rem">منهجية التوثيق ↗</a>
    </div>
  )
}

export const ScientificDisclaimer = () => (
  <div class="scientific-disclaimer card" role="note">
    <strong>تنبيه علمي:</strong>
    <span style="margin-inline-start:.3rem">
      غالب نصوص هذه القاعدة الأولية صياغات مختصرة بأسلوب الفريق العلمي، مستفادة من المصادر المذكورة،
      وليست نقلًا حرفيًا. الاحتجاج العلمي يكون من المصدر الأصلي.
    </span>
    <a href="/methodology" class="text-accent" style="margin-inline-start:.4rem">اقرأ منهجيتنا ↗</a>
  </div>
)

/** Compact source citation block (book / volume / page / link). */
export const SourceCitation = ({
  bookTitle, sourceName, edition, volume, page, sourceUrl,
}: {
  bookTitle?: string
  sourceName?: string
  edition?: string
  volume?: number
  page?: number
  sourceUrl?: string
}) => {
  const parts: string[] = []
  if (sourceName) parts.push(sourceName)
  else if (bookTitle) parts.push(bookTitle)
  if (edition) parts.push(`طبعة: ${edition}`)
  if (volume) parts.push(`ج${volume}`)
  if (page) parts.push(`ص${page}`)
  if (parts.length === 0) return null
  return (
    <div class="source-citation">
      <span class="text-muted text-xs">المصدر:</span>
      <span class="text-sm"> {parts.join(' · ')} </span>
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow" class="text-accent text-xs">
          فتح المصدر ↗
        </a>
      ) : null}
    </div>
  )
}
