// Grantwell's email, briefing screen (master spec §7.3). DESIGN.md §0 narrows
// §7.3's "skeuomorphic email card" to a hairline-topped block — explicitly not
// a bordered box (R4.5's own example names this exact element: "the email is
// a hairline-topped block with a mono `From:` line, not a box").
import { useLocale } from '../../i18n/LocaleProvider';
import './EmailCard.css';

export interface EmailCardProps {
  from: string;
  subject: string;
  body: string;
}

export function EmailCard({ from, subject, body }: EmailCardProps) {
  const { t } = useLocale();

  // gr6-024: the two value spans carried `ph-email__value`, a class no
  // stylesheet has ever mentioned — .ph-email__header owns the mono face and
  // the size for the whole line, and only the LABEL half differs from it
  // (.ph-email__label's medium weight). A span that changes nothing needs no
  // name; the `{' '}` between them is the space, as before.
  return (
    <div className="ph-email">
      <p className="ph-email__header">
        <span className="ph-email__label">{t('email.from')}</span>{' '}
        <span>{from}</span>
      </p>
      <p className="ph-email__header">
        <span className="ph-email__label">{t('email.subject')}</span>{' '}
        <span>{subject}</span>
      </p>
      <p className="ph-email__body">{body}</p>
    </div>
  );
}
