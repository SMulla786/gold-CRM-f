import { Link } from 'react-router-dom'

// TODO before going live: replace with the real support address (AdSense reviewers check this page).
const CONTACT_EMAIL = 'support@example.com'

/** Public privacy policy — required by Google AdSense (ads on the free plan). */
export function Privacy() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 text-sm leading-relaxed sm:p-10 [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_a]:underline">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p>Just Udhari is billing and accounting software for jewellery businesses. This page explains what we store and how ads work.</p>

      <h2>Data we store</h2>
      <p>
        Business details, staff accounts, and the records a business enters (customers, bills, girvi, udhar, stock). These records belong to
        that business. We use them only to run the service and never sell them.
      </p>

      <h2>Cookies</h2>
      <p>We use one login cookie to keep you signed in. It cannot be read by scripts on the page.</p>

      <h2>Advertising (free plan only)</h2>
      <p>
        Businesses on a free plan see ads served by Google AdSense. Google and its partners use cookies to show ads based on your visits to this
        and other websites. We do not send your customer or business records to Google. Paid plans show no ads.
      </p>
      <p>
        Learn how Google uses this data at{' '}
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">policies.google.com/technologies/partner-sites</a>
        . You can turn off personalised ads at{' '}
        <a href="https://myadcenter.google.com" target="_blank" rel="noreferrer">myadcenter.google.com</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or deletion requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <p className="pt-4"><Link to="/login">← Back to login</Link></p>
    </main>
  )
}
