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

  return (
    <div className="ph-email">
      <p className="ph-email__header">
        <span className="ph-email__label">{t('email.from')}</span>{' '}
        <span className="ph-email__value">{from}</span>
      </p>
      <p className="ph-email__header">
        <span className="ph-email__label">{t('email.subject')}</span>{' '}
        <span className="ph-email__value">{subject}</span>
      </p>
      <p className="ph-email__body">{body}</p>
    </div>
  );
}
